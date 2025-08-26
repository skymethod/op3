import { timed } from '../async.ts';
import { isStringRecord } from '../check.ts';
import { DurableObjectStorage, RedBlackTree, chunk } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, LogRawRedirectsBatchRequest, LogRawRedirectsBatchResponse, PackedRedirectLogsResponse, QueryPackedRedirectLogsRequest, Unkinded, QueryHitsIndexRequest, RpcClient, UrlsExternalNotification } from '../rpc_model.ts';
import { executeWithRetries } from '../sleep.ts';
import { consoleError, consoleWarn } from '../tracer.ts';
import { AttNums } from './att_nums.ts';
import { Blobs } from './blobs.ts';
import { computeMinuteFileKey, computeRecordInfo, queryPackedRedirectLogsFromHits, yieldRecords } from './hits_common.ts';
import { computeIndexRecords, queryHitsIndexFromStorage, trimIndexRecords } from './hits_indexes.ts';
import { isRetryableErrorFromR2 } from './r2_bucket_blobs.ts';
import { IpAddressEncryptionFn, IpAddressHashingFn, packRawRedirect } from './raw_redirects.ts';
import { computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { DoNames } from '../do_names.ts';
import { computeServerUrl } from '../client_params.ts';
import { newTextResponse } from '../responses.ts';

export class HitsController {
    private readonly storage: DurableObjectStorage;
    private readonly hitsBlobs: Blobs;
    private readonly encryptIpAddress: IpAddressEncryptionFn;
    private readonly hashIpAddress: IpAddressHashingFn;
    private readonly minuteFiles = new Map<string /* minuteTimestamp */, RedBlackTree<[ string /* record */, string /* sortKey */ ]>>();
    private readonly colo: string;
    private readonly rpcClient?: RpcClient;
    private readonly durableObjectName: string;
    private readonly knownServerUrls: string[] = [];

    private attNums: AttNums | undefined;
    private state: State | undefined;
    private recentMinuteTimestamps: string[] = [];

    constructor(storage: DurableObjectStorage, hitsBlobs: Blobs, colo: string, rpcClient: RpcClient | undefined, durableObjectName: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn, ) {
        this.storage = storage;
        this.hitsBlobs = hitsBlobs;
        this.colo = colo;
        this.rpcClient = rpcClient;
        this.durableObjectName = durableObjectName;
        this.encryptIpAddress = encryptIpAddress;
        this.hashIpAddress = hashIpAddress;
    }

    async logRawRedirectsBatch(request: Unkinded<LogRawRedirectsBatchRequest>): Promise<Unkinded<LogRawRedirectsBatchResponse>> {
        const { rawRedirectsByMessageId, rpcSentTime } = request;
        const { encryptIpAddress, hashIpAddress, colo, storage, rpcClient, durableObjectName, knownServerUrls } = this;
        const { maxMinuteFiles = defaultMaxMinuteFiles } = await this.getOrLoadState();
        const rpcReceivedTime = new Date().toISOString();
        const redirectCount = Object.values(rawRedirectsByMessageId).reduce((a, b) => a + b.rawRedirects.length, 0);
        const sortedTimestamps = Object.values(rawRedirectsByMessageId).map(v => v.timestamp).sort();
        const minTimestamp = sortedTimestamps.at(0);
        const medTimestamp = sortedTimestamps.at(Math.floor(sortedTimestamps.length / 2));
        const maxTimestamp = sortedTimestamps.at(-1);
        const messageIds = Object.keys(rawRedirectsByMessageId);
        const messageCount = messageIds.length;
        
        // process to minute files and index
        const times: Record<string, number> = {};
        const attNums = await this.getOrLoadAttNums();
        const attNumsMaxBefore = attNums.max();
        const minuteTimestampsChanged = new Set<string>();
        const indexRecords: Record<string, string> = {};
        const serverUrlFoundTimestamps: Record<string /* serverUrl */ , string /* found timestamp */> = {};
        const hlsRecords: Record<string, string> = {}; // uuid -> record
        for (const [ _messageId, { rawRedirects, timestamp: _ } ] of Object.entries(rawRedirectsByMessageId)) {
            for (const rawRedirect of rawRedirects) {
                const record = await timed(times, 'packRawRedirects', () => packRawRedirect(rawRedirect, attNums, colo, 'hits', encryptIpAddress, hashIpAddress));
                const obj = attNums.unpackRecord(record);
                if (typeof rawRedirect.other?.sid === 'string') hlsRecords[rawRedirect.uuid] = record;
                if (typeof rawRedirect.other?.subrequest === 'string') continue; // exclude these from hits and new url notifications, they will never match enclosures
                const { sortKey, minuteTimestamp, timestamp } = computeRecordInfo(obj);
                const minuteFile = await timed(times, 'ensureMinuteFileLoaded', () => this.ensureMinuteFileLoaded(minuteTimestamp, attNums));
                const inserted = minuteFile.insert([ record, sortKey ]);
                if (inserted) minuteTimestampsChanged.add(minuteTimestamp);
                await computeIndexRecords(obj, timestamp, sortKey, indexRecords);
                const { url } = obj;
                if (typeof url === 'string') {
                    const serverUrl = computeServerUrl(url);
                    const existing = serverUrlFoundTimestamps[serverUrl];
                    if (!existing || timestamp < existing) serverUrlFoundTimestamps[serverUrl] = timestamp;
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

        // save changed minutefiles, sequentially for now...
        for (const minuteTimestamp of minuteTimestampsChanged) {
            await timed(times, 'saveMinuteFile', () => this.saveMinuteFile(minuteTimestamp, attNums));
        }

        // save index records
        await timed(times, 'saveIndexRecords', async () => {
            for (const batch of chunk(Object.entries(indexRecords), 128)) {
                await storage.put(Object.fromEntries(batch)); // separate transactions, but ok
            }
        });

        // evict old minutefiles from memory
        let evictedCount = 0;
        this.recentMinuteTimestamps = [ ...minuteTimestampsChanged, ...this.recentMinuteTimestamps.filter(v => !minuteTimestampsChanged.has(v)) ];
        while (this.recentMinuteTimestamps.length > maxMinuteFiles) {
            const minuteTimestamp = this.recentMinuteTimestamps.pop();
            if (minuteTimestamp) {
                this.minuteFiles.delete(minuteTimestamp);
                evictedCount++;
            }
        }

        // send new urls notification
        let newUrlCount = 0;
        if (rpcClient) {
            try {
                const newUrlInfos = Object.entries(serverUrlFoundTimestamps).map(v => ({ url: v[0], found: timestampToInstant(v[1]) })).filter(v => !knownServerUrls.includes(v.url));
                newUrlCount = newUrlInfos.length;
                if (newUrlCount > 0) {
                    const time = new Date().toISOString();
                    const notification: UrlsExternalNotification = {
                        type: 'urls',
                        sender: durableObjectName,
                        sent: time,
                        urls: newUrlInfos,
                    };
                
                    await timed(times, 'sendNotification', () => rpcClient.receiveExternalNotification({ received: time, notification }, DoNames.showServer));
                    for (const { url } of newUrlInfos) {
                        const i = knownServerUrls.indexOf(url);
                        if (i > 0) knownServerUrls.splice(i, 1);
                        knownServerUrls.unshift(url);
                    }
                    while (knownServerUrls.length > 1000) knownServerUrls.pop();
                }
            } catch (e) {
                // no big deal, we'll see them again
                consoleWarn('hits-notifier', `HitsController: Failed to send notification: ${(e as Error).stack || e}`);
            }
        }

        // send hls records
        if (Object.keys(hlsRecords).length > 0 && rpcClient) {
            try {
                await timed(times, 'sendPackedRecords', () => rpcClient.sendPackedRecords({ attNums: attNums.toJson(), records: hlsRecords }, DoNames.hlsServer, { sql: true }));
            } catch (e) {
                // don't fail the hits batch for this - maybe later once we've been in production for a while
                consoleWarn('hits-to-hls', `Unexpected error in rpc call: ${(e as Error).stack || e}`);
            }
        }

        // summary analytics
        const { packRawRedirects = 0, saveAttNums = 0, ensureMinuteFileLoaded = 0, saveMinuteFile = 0, saveIndexRecords = 0, sendNotification = 0, sendPackedRecords = 0 } = times;
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
            newUrlCount,
            times: {
                packRawRedirects,
                saveAttNums,
                ensureMinuteFileLoaded,
                saveMinuteFile,
                saveIndexRecords,
                sendNotification,
                sendPackedRecords,
            }
        };
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        const { operationKind, targetPath, parameters = {} } = req;
        const { storage, recentMinuteTimestamps, colo, knownServerUrls } = this;
       
        if (operationKind === 'select' && targetPath === '/hits/attnums') return { results: [ await storage.get('hits.attNums') ] };

        if (targetPath === '/hits/state') {
            const state = await this.getOrLoadState();
            if (operationKind === 'select') return { results: [ { colo, ...state, recentMinuteTimestamps, knownServerUrls: knownServerUrls.length } ] };
            if (operationKind === 'update') {
                const { 'max-minutefiles': maxMinuteFilesStr, ...rest } = parameters;
                if (Object.keys(rest).length > 0) throw new Error(`Unsupported parameters: ${JSON.stringify(rest)}`);
                const changes: string[] = [];
                let newState = state;
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

        if (targetPath === '/hits/indexes' && operationKind === 'delete') {
            const { 'max-iterations': maxIterationsStr = '1', go: goStr, type, ...rest } = parameters;
            if (Object.keys(rest).length > 0) throw new Error(`Unsupported parameters: ${JSON.stringify(rest)}`);
            const maxIterations = parseInt(maxIterationsStr);
            const go = goStr === 'true';
            const result = await trimIndexRecords({ maxIterations, go, type }, storage);
            return { results: [ result ] };
        }

        throw new Error(`Unsupported hits query`);
    }

    async queryPackedRedirectLogs(request: Unkinded<QueryPackedRedirectLogsRequest>): Promise<PackedRedirectLogsResponse> {
        const { hitsBlobs } = this;
        const attNums = await this.getOrLoadAttNums();
        return await queryPackedRedirectLogsFromHits(request, { hitsBlobs, attNums, indexSortKeys: undefined, descending: false });
    }

    async queryHitsIndex(request: Unkinded<QueryHitsIndexRequest>): Promise<Response> {
        const { storage, hashIpAddress } = this;
        const { rawIpAddress } = request;
        if (typeof rawIpAddress === 'string') {
            const hashedIpAddress = unpackHashedIpAddressHash(await hashIpAddress(rawIpAddress, { timestamp: computeTimestamp() }));
            request = { ...request, hashedIpAddress, rawIpAddress: undefined };
        }
        const sortKeys = await queryHitsIndexFromStorage(request, storage);
        return new Response(sortKeys.map(v => `${v}\n`).join('')); // stream if allowing larger limits in the future
    }

    async getMetrics(): Promise<Response> {
        await Promise.resolve();

        const lines: string[] = [];
        const time = Date.now();
        {
            const id = 'hitc_known_server_urls_count';
            lines.push(`# HELP ${id} knownServerUrls.length`, `# TYPE ${id} gauge`);
            lines.push(`${id} ${this.knownServerUrls.length} ${time}`);
            lines.push('');
        }

        {
            const id = 'hitc_minutes_count';
            lines.push(`# HELP ${id} recentMinuteTimestamps.length`, `# TYPE ${id} gauge`);
            lines.push(`${id} ${this.recentMinuteTimestamps.length} ${time}`);
            lines.push('');
        }

        const sortedTimestamps = [...this.recentMinuteTimestamps].sort();
        const maxTimestampAgeMillis = sortedTimestamps.length > 0 ? (time - new Date(timestampToInstant(sortedTimestamps[sortedTimestamps.length - 1])).getTime()) : 0;
        {
            const id = 'hitc_max_timestamp_age_seconds';
            lines.push(`# HELP ${id} how far behind is the newest minutestamp`, `# TYPE ${id} gauge`);
            lines.push(`${id} ${Math.round(maxTimestampAgeMillis / 1000)} ${time}`);
            lines.push('');
        }

        const minTimestampAgeMillis = sortedTimestamps.length > 0 ? (time - new Date(timestampToInstant(sortedTimestamps[0])).getTime()) : 0;
        {
            const id = 'hitc_min_timestamp_age_seconds';
            lines.push(`# HELP ${id} how far behind is the oldest minutestamp`, `# TYPE ${id} gauge`);
            lines.push(`${id} ${Math.round(minTimestampAgeMillis / 1000)} ${time}`);
            lines.push('');
        }

        return newTextResponse(lines.join('\n'));
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
            const putPromise = hitsBlobs.put(computeMinuteFileKey(minuteTimestamp), readable); // don't await!
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
    maxMinuteFiles?: number,
};

function isValidState(obj: unknown): obj is State {
    return isStringRecord(obj) 
        && (obj.maxMinuteFiles === undefined || typeof obj.maxMinuteFiles === 'number')
        ;
}

async function loadAttNums(storage: DurableObjectStorage): Promise<AttNums> {
    const record = await storage.get('hits.attNums');
    console.log(`loadAttNums: ${JSON.stringify(record)}`);
    try {
        if (record !== undefined) return AttNums.fromJson(record);
    } catch (e) {
        consoleError('hits-loading-attnums', `Error loading AttNums from record ${JSON.stringify(record)}: ${(e as Error).stack || e}`);
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
            consoleError('hits-loading-state', `Error loading State from record ${JSON.stringify(record)}: ${(e as Error).stack || e}`);
        }
    }
    return { maxMinuteFiles: defaultMaxMinuteFiles };
}

function compareMinuteFileEntry(lhs: [ string, string ], rhs: [ string, string ]): number {
    return lhs[1] < rhs[1] ? -1 : lhs[1] > rhs[1] ? 1 : 0;
}
