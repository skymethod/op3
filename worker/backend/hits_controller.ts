import { timed } from '../async.ts';
import { DurableObjectStorage, RedBlackTree } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, LogRawRedirectsBatchRequest, LogRawRedirectsBatchResponse, PackedRedirectLogsResponse, QueryPackedRedirectLogsRequest, Unkinded } from '../rpc_model.ts';
import { computeLinestream } from '../streams.ts';
import { consoleError } from '../tracer.ts';
import { AttNums } from './att_nums.ts';
import { Blobs } from './blobs.ts';
import { IpAddressEncryptionFn, IpAddressHashingFn, packRawRedirect } from './raw_redirects.ts';
import { check, checkMatches, isStringRecord } from '../check.ts';
import { executeWithRetries } from '../sleep.ts';
import { isRetryableErrorFromR2 } from './r2_bucket_blobs.ts';
import { addMinutes, computeTimestamp, timestampToInstant, isValidTimestamp } from '../timestamp.ts';

export class HitsController {
    private readonly storage: DurableObjectStorage;
    private readonly hitsBlobs: Blobs;
    private readonly encryptIpAddress: IpAddressEncryptionFn;
    private readonly hashIpAddress: IpAddressHashingFn;
    private readonly minuteFiles = new Map<string /* minuteTimestamp */, RedBlackTree<[ string /* record */, string /* sortKey */ ]>>();
    private readonly colo: string;
    private attNums: AttNums | undefined;
    private state: State | undefined;
    private recentMinuteTimestamps: string[] = [];

    constructor(storage: DurableObjectStorage, hitsBlobs: Blobs, colo: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn, ) {
        this.storage = storage;
        this.hitsBlobs = hitsBlobs;
        this.colo = colo;
        this.encryptIpAddress = encryptIpAddress;
        this.hashIpAddress = hashIpAddress;
    }

    async logRawRedirectsBatch(request: Unkinded<LogRawRedirectsBatchRequest>): Promise<Unkinded<LogRawRedirectsBatchResponse>> {
        const { rawRedirectsByMessageId, rpcSentTime } = request;
        const { encryptIpAddress, hashIpAddress, colo } = this;
        const { minuteFilesEnabled = false, maxMinuteFiles = defaultMaxMinuteFiles } = await this.getOrLoadState();
        const rpcReceivedTime = new Date().toISOString();
        const redirectCount = Object.values(rawRedirectsByMessageId).reduce((a, b) => a + b.rawRedirects.length, 0);
        const sortedTimestamps = Object.values(rawRedirectsByMessageId).map(v => v.timestamp).sort();
        const minTimestamp = sortedTimestamps.at(0);
        const medTimestamp = sortedTimestamps.at(Math.floor(sortedTimestamps.length / 2));
        const maxTimestamp = sortedTimestamps.at(-1);
        const messageIds = Object.keys(rawRedirectsByMessageId);
        const messageCount = messageIds.length;
        
        // save to aggregated minute files
        const times: Record<string, number> = {};
        const attNums = await this.getOrLoadAttNums();
        const attNumsMaxBefore = attNums.max();
        const minuteTimestampsChanged = new Set<string>();
        for (const [ _messageId, { rawRedirects, timestamp: _ } ] of Object.entries(rawRedirectsByMessageId)) {
            for (const rawRedirect of rawRedirects) {
                const record = await timed(times, 'packRawRedirects', () => packRawRedirect(rawRedirect, attNums, colo, 'hits', encryptIpAddress, hashIpAddress));
                if (minuteFilesEnabled) {
                    const obj = attNums.unpackRecord(record);
                    const { sortKey, minuteTimestamp } = computeRecordInfo(obj);
                    const minuteFile = await timed(times, 'ensureMinuteFileLoaded', () => this.ensureMinuteFileLoaded(minuteTimestamp, attNums));
                    const inserted = minuteFile.insert([ record, sortKey ]);
                    if (inserted) minuteTimestampsChanged.add(minuteTimestamp);
                }
            }
        }
        let evictedCount = 0;
        if (minuteFilesEnabled) {
            // save changed minutefiles, sequentially for now...
            for (const minuteTimestamp of minuteTimestampsChanged) {
                await timed(times, 'saveMinuteFile', () => this.saveMinuteFile(minuteTimestamp, attNums));
            }

            // evict old minutefiles from memory
            this.recentMinuteTimestamps = [ ...minuteTimestampsChanged, ...this.recentMinuteTimestamps.filter(v => !minuteTimestampsChanged.has(v)) ];
            while (this.recentMinuteTimestamps.length > maxMinuteFiles) {
                const minuteTimestamp = this.recentMinuteTimestamps.pop();
                if (minuteTimestamp) {
                    this.minuteFiles.delete(minuteTimestamp);
                    evictedCount++;
                }
            }
        }

        // save attnums if necessary
        if (attNums.max() !== attNumsMaxBefore) {
            await timed(times, 'saveAttNums', () => this.storage.transaction(async txn => {
                const record = attNums.toJson();
                console.log(`saveAttNums: ${JSON.stringify(record)}`);
                await txn.put('hits.attNums', record);
            }));
        }

        // summary analytics
        const { packRawRedirects = 0, saveAttNums = 0, ensureMinuteFileLoaded = 0, saveMinuteFile = 0 } = times;
        const putCount = minuteTimestampsChanged.size;

        return { 
            processedMessageIds: messageIds, // TODO consider them all acked for now
            colo,
            rpcSentTime,
            rpcReceivedTime,
            minTimestamp,
            medTimestamp,
            maxTimestamp,
            messageCount,
            redirectCount,
            putCount,
            evictedCount,
            times: {
                packRawRedirects,
                saveAttNums,
                ensureMinuteFileLoaded,
                saveMinuteFile,
            }
        };
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        const { operationKind, targetPath, parameters = {} } = req;
        const { storage, recentMinuteTimestamps, colo } = this;
       
        if (operationKind === 'select' && targetPath === '/hits/attnums') return { results: [ await storage.get('hits.attNums') ] };

        if (targetPath === '/hits/state') {
            const state = await this.getOrLoadState();
            if (operationKind === 'select') return { results: [ { colo, ...state, recentMinuteTimestamps } ] };
            if (operationKind === 'update') {
                const { 'minutefiles-enabled': minuteFilesEnabledStr, 'max-minutefiles': maxMinuteFilesStr, ...rest } = parameters;
                if (Object.keys(rest).length > 0) throw new Error(`Unsupported parameters: ${JSON.stringify(rest)}`);
                const changes: string[] = [];
                let newState = state;
                if (typeof minuteFilesEnabledStr === 'string') {
                    const minuteFilesEnabled = minuteFilesEnabledStr === 'true';
                    if (minuteFilesEnabled !== state.minuteFilesEnabled) {
                        newState = { ...newState, minuteFilesEnabled };
                        changes.push(`state.minuteFilesEnabled: ${state.minuteFilesEnabled} -> ${minuteFilesEnabled}`);
                    }
                }
                if (typeof maxMinuteFilesStr === 'string') {
                    const maxMinuteFiles = parseInt(maxMinuteFilesStr);
                    if (maxMinuteFiles !== state.maxMinuteFiles) {
                        newState = { ...state, maxMinuteFiles };
                        changes.push(`state.maxMinuteFiles: ${state.maxMinuteFiles} -> ${maxMinuteFiles}`);
                    }
                }
                if (changes.length > 0) {
                    await storage.put('hits.state', newState);
                    this.state = newState;
                }
                return { message: changes.length > 0 ? changes.join(', ') : 'no changes' };
            }
        }

        throw new Error(`Unsupported hits query`);
    }

    async queryPackedRedirectLogs(request: Unkinded<QueryPackedRedirectLogsRequest>): Promise<PackedRedirectLogsResponse> {
        const { hitsBlobs } = this;
        const attNums = await this.getOrLoadAttNums();
        const { limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, startAfterRecordKey } = request;
        const records: Record<string, string> = {}; // sortKey(timestamp+uuid) -> packed record
        
        if (startTimeInclusive === undefined) throw new Error(`'startTimeInclusive' is required`);
        if (endTimeExclusive === undefined) throw new Error(`'endTimeExclusive' is required`);
        if (startTimeExclusive !== undefined) throw new Error(`'startTimeExclusive' is not supported`);

        const startTimestamp = computeTimestamp(startTimeInclusive);
        const startMinuteTimestamp = computeMinuteTimestamp(startTimestamp);
        const endTimestamp = computeTimestamp(endTimeExclusive);
        const endMinuteTimestamp = computeMinuteTimestamp(endTimestamp);
        const startAfterRecordKeyMinuteTimestamp = startAfterRecordKey ? computeMinuteTimestamp(unpackSortKey(startAfterRecordKey).timestamp) : undefined;

        await (async () => {
            let minuteTimestamp = startAfterRecordKeyMinuteTimestamp ?? startMinuteTimestamp;
            let recordCount = 0;
            while (minuteTimestamp < endMinuteTimestamp && recordCount < limit) {
                console.log({ minuteTimestamp });
                const stream = await hitsBlobs.get(computeMinuteFileKey(minuteTimestamp), 'stream');
                if (stream !== undefined) {
                    for await (const [ record, sortKey ] of yieldRecords(stream, attNums, minuteTimestamp)) {
                        const recordTimestamp = sortKey.substring(0, 15);
                        if (startTimestamp && recordTimestamp < startTimestamp) continue;
                        if (startAfterRecordKey && sortKey <= startAfterRecordKey) continue;
                        if (endTimestamp && recordTimestamp >= endTimestamp) return;
                        records[sortKey] = record;
                        recordCount++;
                        if (recordCount >= limit) return;
                    }
                }
                minuteTimestamp = computeTimestamp(addMinutes(timestampToInstant(minuteTimestamp), 1));
            }
        })();

        return { kind: 'packed-redirect-logs', namesToNums: attNums.toJson(), records };
    }

    //

    private async getOrLoadState(): Promise<State> {
        if (!this.state) this.state = await loadState(this.storage);
        return this.state;
    }

    private async getOrLoadAttNums(): Promise<AttNums> {
        if (!this.attNums) this.attNums = await loadAttNums(this.storage);
        return this.attNums;
    }

    private async ensureMinuteFileLoaded(minuteTimestamp: string, attNums: AttNums): Promise<RedBlackTree<[ string, string ]>> {
        const { minuteFiles, hitsBlobs } = this;
        const existing = minuteFiles.get(minuteTimestamp);
        if (existing) return existing;

        const stream = await hitsBlobs.get(computeMinuteFileKey(minuteTimestamp), 'stream');
        const rt = new RedBlackTree(compareMinuteFileEntry);
        minuteFiles.set(minuteTimestamp, rt);
        if (!stream) return rt;

        for await (const recordAndSortKey of yieldRecords(stream, attNums, minuteTimestamp)) {
            rt.insert(recordAndSortKey);
        }
        return rt;
    }

    private async saveMinuteFile(minuteTimestamp: string, attNums: AttNums): Promise<void> {
        const { minuteFiles, hitsBlobs } = this;
        const file = minuteFiles.get(minuteTimestamp);
        if (!file) throw new Error(`No minute file for ${minuteTimestamp}`);

        const header = encoder.encode(`${JSON.stringify(attNums.toJson())}\n`);
        let contentLength = header.length;
        for (const [ record ] of file) {
            contentLength += encoder.encode(`${record}\n`).length;
        }

        await executeWithRetries(async () => {
            // deno-lint-ignore no-explicit-any
            const { readable, writable } = new (globalThis as any).FixedLengthStream(contentLength);
            const putPromise = hitsBlobs.put(computeMinuteFileKey(minuteTimestamp), readable) // don't await!
            const writer = writable.getWriter();
            
            writer.write(header);
            for (const [ record ] of file) {
                writer.write(encoder.encode(`${record}\n`));
            }
            await writer.close();
            // await writable.close(); // will throw on cf
            await putPromise;
        }, { tag: 'save-minute-file', maxRetries: 3, isRetryable: isRetryableErrorFromR2 });
    }

}

//

const encoder = new TextEncoder();
const defaultMaxMinuteFiles = 5; // how many of the most recently changed minutefiles can be in memory at once, expect ~682kb/minutefile

type State = {
    minuteFilesEnabled?: boolean, // TODO remove once default
    maxMinuteFiles?: number,
};

function isValidState(obj: unknown): obj is State {
    return isStringRecord(obj) 
        && (obj.minuteFilesEnabled === undefined || typeof obj.minuteFilesEnabled === 'boolean')
        && (obj.maxMinuteFiles === undefined || typeof obj.maxMinuteFiles === 'number')
        ;
}

async function loadAttNums(storage: DurableObjectStorage): Promise<AttNums> {
    const record = await storage.get('hits.attNums');
    console.log(`loadAttNums: ${JSON.stringify(record)}`);
    try {
        if (record !== undefined) return AttNums.fromJson(record);
    } catch (e) {
        consoleError('hits-loading-attnums', `Error loading AttNums from record ${JSON.stringify(record)}: ${e.stack || e}`);
    }
    return new AttNums();
}

async function loadState(storage: DurableObjectStorage): Promise<State> {
    const record = await storage.get('hits.state');
    console.log(`loadState: ${JSON.stringify(record)}`);
    if (record !== undefined) {
        try {
            if (isValidState(record)) return record;
            throw new Error('Invalid');
        } catch (e) {
            consoleError('hits-loading-state', `Error loading State from record ${JSON.stringify(record)}: ${e.stack || e}`);
        }
    }
    return { minuteFilesEnabled: false, maxMinuteFiles: defaultMaxMinuteFiles };
}

function compareMinuteFileEntry(lhs: [ string, string ], rhs: [ string, string ]): number {
    return lhs[1] < rhs[1] ? -1 : lhs[1] > rhs[1] ? 1 : 0;
}

function computeRecordInfo(obj: Record<string, string>): { sortKey: string, minuteTimestamp: string } {
    const { timestamp, uuid } = obj;
    if (typeof timestamp !== 'string') throw new Error(`No timestamp! ${JSON.stringify(obj)}`);
    if (typeof uuid !== 'string') throw new Error(`No uuid! ${JSON.stringify(obj)}`);
    const sortKey = `${timestamp}-${uuid}`;
    const minuteTimestamp = computeMinuteTimestamp(timestamp);
    return { sortKey, minuteTimestamp };
}

function unpackSortKey(sortKey: string): { timestamp: string, uuid: string} {
    const [ _, timestamp, uuid ] = checkMatches('sortKey', sortKey, /^(\d{15})-([0-9a-f]{32})$/);
    check('sortKey', sortKey, isValidTimestamp(timestamp));
    return { timestamp, uuid };
}

function computeMinuteTimestamp(timestamp: string): string {
    return `${timestamp.substring(0, 10)}00000`;
} 

function computeMinuteFileKey(minuteTimestamp: string): string {
    return `minutes/${minuteTimestamp}.txt`;
}

async function* yieldRecords(stream: ReadableStream<Uint8Array>, attNums: AttNums, minuteTimestamp: string): AsyncGenerator<[ string, string], void, unknown> {
    let fileAttNums: AttNums | undefined;
    for await (const line of computeLinestream(stream)) {
        if (line === '') continue;
        if (!fileAttNums) {
            fileAttNums = AttNums.fromJson(JSON.parse(line));
            continue;
        }
        // TODO no need to repack if attnums are compatible
        const obj = fileAttNums.unpackRecord(line);
        const record = attNums.packRecord(obj);
        const { sortKey, minuteTimestamp: recordMinuteTimestamp } = computeRecordInfo(obj);
        if (recordMinuteTimestamp !== minuteTimestamp) throw new Error(`Bad minuteTimestamp ${recordMinuteTimestamp}, expected ${minuteTimestamp} ${JSON.stringify(obj)}`);
        yield [ record, sortKey ];
    }
}
