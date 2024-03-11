import { timed } from '../async.ts';
import { DurableObjectStorage, RedBlackTree } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, LogRawRedirectsBatchRequest, LogRawRedirectsBatchResponse, Unkinded } from '../rpc_model.ts';
import { computeLinestream } from '../streams.ts';
import { writeTraceEvent, consoleError, consoleWarn } from '../tracer.ts';
import { AttNums } from './att_nums.ts';
import { Blobs } from './blobs.ts';
import { IpAddressEncryptionFn, IpAddressHashingFn, packRawRedirect } from './raw_redirects.ts';
import { Configuration } from '../configuration.ts';

export class HitsController {
    private readonly storage: DurableObjectStorage;
    private readonly hitsBlobs: Blobs;
    private readonly configuration: Configuration;
    private readonly state: State;
    private readonly encryptIpAddress: IpAddressEncryptionFn;
    private readonly hashIpAddress: IpAddressHashingFn;
    private readonly minuteFiles = new Map<string /* minuteTimestamp */, RedBlackTree<[ string /* record */, string /* sortKey */ ]>>();
    private readonly maxMinuteFiles = 5; // how many of the most recently changed minutefiles can be in memory at once, expect ~682kb/minutefile

    private attNums: AttNums | undefined;
    private recentMinuteTimestamps: string[] = [];

    constructor(storage: DurableObjectStorage, hitsBlobs: Blobs, configuration: Configuration, colo: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn, ) {
        this.storage = storage;
        this.hitsBlobs = hitsBlobs;
        this.configuration = configuration;
        this.state = { colo, batches: [] };
        this.encryptIpAddress = encryptIpAddress;
        this.hashIpAddress = hashIpAddress;
    }

    async logRawRedirectsBatch(request: Unkinded<LogRawRedirectsBatchRequest>): Promise<Unkinded<LogRawRedirectsBatchResponse>> {
        const { rawRedirectsByMessageId, rpcSentTime } = request;
        const { state, encryptIpAddress, hashIpAddress, maxMinuteFiles, configuration } = this;
        const rpcReceivedTime = new Date().toISOString();
        const redirectCount = Object.values(rawRedirectsByMessageId).reduce((a, b) => a + b.rawRedirects.length, 0);
        const sortedTimestamps = Object.values(rawRedirectsByMessageId).map(v => v.timestamp).sort();
        const minTimestamp = sortedTimestamps.at(0);
        const maxTimestamp = sortedTimestamps.at(-1);
        const messageIds = Object.keys(rawRedirectsByMessageId);
        const messageCount = messageIds.length;
        
        try {
            // save to aggregated minute files
            const times: Record<string, number> = {};
            const attNums = await this.getOrLoadAttNums();
            const attNumsMaxBefore = attNums.max();
            const minuteTimestampsChanged = new Set<string>();
            const minuteFilesEnabled = await configuration.get('hits-controller-minutefiles') === 'enabled';
            for (const [ messageId, { rawRedirects, timestamp } ] of Object.entries(rawRedirectsByMessageId)) {
                for (const rawRedirect of rawRedirects) {
                    const record = await timed(times, 'packRawRedirects', () => packRawRedirect(rawRedirect, attNums, state.colo, 'hits', encryptIpAddress, hashIpAddress));
                    if (minuteFilesEnabled) {
                        const obj = attNums.unpackRecord(record);
                        const { sortKey, minuteTimestamp } = computeRecordInfo(obj);
                        const minuteFile = await timed(times, 'ensureMinutefileLoaded', () => this.ensureMinuteFileLoaded(minuteTimestamp, attNums));
                        const inserted = minuteFile.insert([ record, sortKey ]);
                        if (inserted) minuteTimestampsChanged.add(minuteTimestamp);
                    }
                }
            }
            if (minuteFilesEnabled) {
                // save changed minutefiles, sequentially for now...
                for (const minuteTimestamp of minuteTimestampsChanged) {
                    await timed(times, 'saveMinutefile', () => this.saveMinutefile(minuteTimestamp, attNums));
                }

                // evict old minutefiles from memory
                this.recentMinuteTimestamps = [ ...minuteTimestampsChanged, ...this.recentMinuteTimestamps.filter(v => !minuteTimestampsChanged.has(v)) ];
                while (this.recentMinuteTimestamps.length > maxMinuteFiles) {
                    const minuteTimestamp = this.recentMinuteTimestamps.pop();
                    if (minuteTimestamp) this.minuteFiles.delete(minuteTimestamp);
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

            // update state
            state.batches.push({ rpcSentTime, rpcReceivedTime, minTimestamp, maxTimestamp, messageCount, redirectCount });
            while (state.batches.length > 50) state.batches.shift();

            // summary analytics TODO move up to queue handler?
            const { packRawRedirects = 0, saveAttNums = 0, ensureMinutefileLoaded = 0, saveMinutefile = 0 } = times;
            writeTraceEvent({ kind: 'generic', type: 'hits-batch', strings: [ rpcSentTime, rpcReceivedTime, minTimestamp ?? '', maxTimestamp ?? '' ], doubles: [ messageCount, redirectCount, packRawRedirects, saveAttNums, ensureMinutefileLoaded, saveMinutefile ] });

        } catch (e) {
            consoleWarn('hits-controller', `Error in logRawRedirectsBatch: ${e.stack || e}`);
        }

        // TODO consider them all acked for now
        return { messageIds };
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        const { operationKind, targetPath } = req;
        const { storage, recentMinuteTimestamps } = this;
        if (operationKind === 'select' && targetPath === '/hits/state') return { results: [ { ...this.state, recentMinuteTimestamps } ] };
        if (operationKind === 'select' && targetPath === '/hits/attnums') return { results: [ await storage.get('hits.attNums') ] };

        throw new Error(`Unsupported hits query`);
    }

    //

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
        if (!stream) return rt;

        let fileAttNums: AttNums | undefined;
        for await (const line of computeLinestream(stream)) {
            if (line === '') continue;
            if (!fileAttNums) {
                fileAttNums = AttNums.fromJson(JSON.parse(line));
                continue;
            }
            const obj = fileAttNums.unpackRecord(line);
            const record = attNums.packRecord(obj);
            const { sortKey, minuteTimestamp: recordMinuteTimestamp } = computeRecordInfo(obj);
            if (recordMinuteTimestamp !== minuteTimestamp) throw new Error(`Bad minuteTimestamp ${recordMinuteTimestamp}, expected ${minuteTimestamp} ${JSON.stringify(obj)}`);
            rt.insert([ record, sortKey ]);
        }
        return rt;
    }

    private async saveMinutefile(minuteTimestamp: string, attNums: AttNums): Promise<void> {
        const { minuteFiles, hitsBlobs } = this;
        const file = minuteFiles.get(minuteTimestamp);
        if (!file) throw new Error(`No minute file for ${minuteTimestamp}`);

        const header = encoder.encode(`${attNums.toJson()}\n`);
        let contentLength = header.length;
        for (const [ record ] of file) {
            contentLength += encoder.encode(`${record}\n`).length;
        }

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
    }

}

//

const encoder = new TextEncoder();

type State = { colo: string, batches: { rpcSentTime: string, rpcReceivedTime: string, minTimestamp?: string, maxTimestamp?: string, messageCount: number, redirectCount: number }[] };

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

function compareMinuteFileEntry(lhs: [ string, string ], rhs: [ string, string ]): number {
    return lhs[1] < rhs[1] ? -1 : lhs[1] > rhs[1] ? 1 : 0;
}

function computeRecordInfo(obj: Record<string, string>): { sortKey: string, minuteTimestamp: string } {
    const { timestamp, uuid } = obj;
    if (typeof timestamp !== 'string') throw new Error(`No timestamp! ${JSON.stringify(obj)}`);
    if (typeof uuid !== 'string') throw new Error(`No uuid! ${JSON.stringify(obj)}`);
    const sortKey = `${timestamp}-${uuid}`;
    const minuteTimestamp = `${timestamp.substring(0, 10)}00000`;
    return { sortKey, minuteTimestamp };
}

function computeMinuteFileKey(minuteTimestamp: string): string {
    return `minutes/${minuteTimestamp}.txt`;
}
