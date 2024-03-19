import { timed } from '../async.ts';
import { isStringRecord } from '../check.ts';
import { DurableObjectStorage, RedBlackTree } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, LogRawRedirectsBatchRequest, LogRawRedirectsBatchResponse, PackedRedirectLogsResponse, QueryPackedRedirectLogsRequest, Unkinded, QueryHitsIndexRequest } from '../rpc_model.ts';
import { executeWithRetries } from '../sleep.ts';
import { consoleError } from '../tracer.ts';
import { AttNums } from './att_nums.ts';
import { Blobs } from './blobs.ts';
import { computeMinuteFileKey, computeRecordInfo, queryPackedRedirectLogsFromHits, yieldRecords } from './hits_common.ts';
import { isRetryableErrorFromR2 } from './r2_bucket_blobs.ts';
import { IpAddressEncryptionFn, IpAddressHashingFn, packRawRedirect } from './raw_redirects.ts';

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
        return await queryPackedRedirectLogsFromHits(request, hitsBlobs, attNums, undefined);
    }

    async queryHitsIndex(_request: Unkinded<QueryHitsIndexRequest>): Promise<Response> {
        await Promise.resolve();
        throw new Error('TODO');
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
