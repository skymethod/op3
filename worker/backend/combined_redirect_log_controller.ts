import { Bytes, DurableObjectStorage, DurableObjectStorageValue } from '../deps.ts';
import { checkMatches, isStringRecord } from '../check.ts';
import { AdminRebuildIndexRequest, AdminRebuildIndexResponse, AlarmPayload, QueryRedirectLogsRequest, RpcClient, Unkinded } from '../rpc_model.ts';
import { AttNums } from './att_nums.ts';
import { isValidTimestamp, timestampToInstant } from '../timestamp.ts';
import { isValidUuid } from '../uuid.ts';
import { getOrInit } from '../maps.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { queryCombinedRedirectLogs } from './combined_redirect_log_query.ts';

export class CombinedRedirectLogController {
    static readonly processAlarmKind = 'CombinedRedirectLogController.processAlarmKind';

    private readonly storage: DurableObjectStorage;
    private readonly rpcClient: RpcClient;

    private attNums: AttNums | undefined;

    constructor(storage: DurableObjectStorage, rpcClient: RpcClient) {
        this.storage = storage;
        this.rpcClient = rpcClient;
    }

    async receiveNotification(opts: { doName: string; timestampId: string; fromColo: string; }) {
        const { doName, timestampId, fromColo } = opts;
        const { storage } = this;

        // update source state
        const notificationTime = new Date().toISOString();
        const oldState = await loadSourceState(doName, storage);
        const newState = { ...oldState, doName, notificationTimestampId: timestampId, notificationFromColo: fromColo, notificationTime };
        await storage.put(`crl.ss.${doName}`, newState);

        await storage.transaction(async txn => {
            await txn.put('alarm.payload', { kind: CombinedRedirectLogController.processAlarmKind } as AlarmPayload);
            await txn.setAlarm(Date.now());
        });
    }

    async process(): Promise<void> {
        const { storage, rpcClient } = this;

        // load and save new records from all sources
        const map = await storage.list({ prefix: 'crl.ss.'});
        console.log(`CombinedRedirectLogController: process: ${map.size} source states`);

        const attNums = await this.getOrLoadAttNums();

        for (const state of map.values()) {
            if (!isValidSourceState(state)) {
                console.warn(`CombinedRedirectLogController: Skipping bad SourceState record: ${JSON.stringify(state)}`);
                continue;
            }
            await processSource(state, rpcClient, attNums, storage);
        }
    }

    async listSources(): Promise<Record<string, unknown>[]> {
        const map = await this.storage.list({ prefix: 'crl.ss.' });
        return [...map.values()].filter(isStringRecord);
    }

    async listRecords(): Promise<Record<string, unknown>[]> {
        const attNums = await this.getOrLoadAttNums();

        const map = await this.storage.list({ prefix: 'crl.r.', limit: 200 });
        const rt: Record<string, unknown>[] = [];
        for (const [ key, record ] of map) {
            if (typeof record === 'string') {
                const obj = attNums.unpackRecord(record);
                rt.push({ 
                    key: key.substring('crl.r.'.length),
                    time: timestampToInstant(obj.timestamp),
                    ...obj,
                    encryptedIpAddress: undefined });
            }
        }
        return rt;
    }

    async queryRedirectLogs(request: Unkinded<QueryRedirectLogsRequest>): Promise<Response> {
        const attNums = await this.getOrLoadAttNums();
        return await queryCombinedRedirectLogs(request, attNums, this.storage);
    }

    async rebuildIndex(request: Unkinded<AdminRebuildIndexRequest>): Promise<AdminRebuildIndexResponse> {
        const attNums = await this.getOrLoadAttNums();
        return computeRebuildIndexResponse(request, attNums, this.storage);
    }

    //

    private async getOrLoadAttNums(): Promise<AttNums> {
        if (!this.attNums) this.attNums = await loadAttNums(this.storage);
        return this.attNums;
    }

}

//

async function loadSourceState(doName: string, storage: DurableObjectStorage): Promise<SourceState | undefined> {
    const state = await storage.get(`crl.ss.${doName}`);
    if (state !== undefined && !isValidSourceState(state)) {
        console.warn(`CombinedRedirectLogController: Invalid source state for ${doName}: ${JSON.stringify(state)}`);
        return undefined;
    }
    return state;
}

async function loadAttNums(storage: DurableObjectStorage): Promise<AttNums> {
    const record = await storage.get('crl.attNums');
    console.log(`CombinedRedirectLogController: loadAttNums: ${JSON.stringify(record)}`);
    try {
        if (record !== undefined) return AttNums.fromJson(record);
    } catch (e) {
        console.error(`CombinedRedirectLogController: Error loading AttNums from record ${JSON.stringify(record)}: ${e.stack || e}`);
    }
    return new AttNums();
}

async function processSource(state: SourceState, rpcClient: RpcClient, attNums: AttNums, storage: DurableObjectStorage) {
    const { doName } = state;
    const nothingNew = typeof state.notificationTimestampId === 'string' && state.notificationTimestampId === state.haveTimestampId;
    console.log(`CombinedRedirectLogController: processSource ${doName}: ${nothingNew ? `nothing new` : JSON.stringify(state)}`);
    if (nothingNew) return;

    if (typeof state.notificationTimestampId === 'string' && state.notificationTimestampId === state.haveTimestampId) {
        console.log(`CombinedRedirectLogController: Up to date at ${state.notificationTimestampId}`);
        return;
    }

    // fetch some new records from the source DO
    const startAfterTimestampId = state.haveTimestampId;
    const { namesToNums, records } = await rpcClient.getNewRedirectLogs({ limit: 10, startAfterTimestampId }, doName);
    console.log(`${Object.keys(records).length} records`);

    const sourceAttNums = new AttNums(namesToNums);
    const maxBefore = attNums.max();
    const newRecords: Record<string, string> = {};
    const newIndexRecords = new Map<IndexId, Record<string, DurableObjectStorageValue>>();
    let maxTimestampId = startAfterTimestampId;
    for (const [ timestampId, sourceRecord ] of Object.entries(records)) {
        if (maxTimestampId === undefined || timestampId > maxTimestampId) maxTimestampId = timestampId;
        const obj = sourceAttNums.unpackRecord(sourceRecord);
        // console.log(`${timestampId}: ${JSON.stringify(obj)}`);
        const { uuid, timestamp } = obj;
        if (typeof uuid !== 'string' || !isValidUuid(uuid)) {
            console.warn(`CombinedRedirectLogController: Skipping bad source obj (invalid uuid): ${JSON.stringify(obj)}`);
            continue;
        }
        if (typeof timestamp !== 'string' || !isValidTimestamp(timestamp)) {
            console.warn(`CombinedRedirectLogController: Skipping bad source obj (invalid timestamp): ${JSON.stringify(obj)}`);
            continue;
        }
        const timestampAndUuid = `${timestamp}-${uuid}`;
        const key = `crl.r.${timestampAndUuid}`;
        obj.source = doName;
        await computeIndexRecords(obj, timestamp, timestampAndUuid, key, newIndexRecords);
        const record = attNums.packRecord(obj);
        newRecords[key] = record;
    }
    if (attNums.max() > maxBefore) {
        await storage.put('crl.attNums', attNums.toJson());
    }
    if (Object.keys(newRecords).length > 0 || newIndexRecords.size > 0 || maxTimestampId !== startAfterTimestampId ) {
        // two transactions to stay under 128
        // it's ok if this first transaction runs more than once

        // first, save data records
        await storage.transaction(async txn => {
            if (Object.keys(newRecords).length > 0) {
                console.log(`CombinedRedirectLogController: Saving ${Object.keys(newRecords).length} imported records from ${doName}`);
                await txn.put(newRecords);
            }
        });

        // then, save index records and update source state
        const newState: SourceState = { ...state, haveTimestampId: maxTimestampId };
        await storage.transaction(async txn => {
            if (newIndexRecords.size > 0) {
                for (const [ indexId, records ] of newIndexRecords) {
                    console.log(`CombinedRedirectLogController: Saving ${Object.keys(records).length} ${IndexId[indexId]} index records from ${doName}`);
                    await txn.put(records);
                }
            }
            if (maxTimestampId !== startAfterTimestampId) {
                console.log(`CombinedRedirectLogController: Updating haveTimestampId from ${startAfterTimestampId} to ${maxTimestampId} for ${doName}`);
                await txn.put(`crl.ss.${doName}`, newState);
            }
        });
    }
}

async function computeRebuildIndexResponse(request: Unkinded<AdminRebuildIndexRequest>, attNums: AttNums, storage: DurableObjectStorage): Promise<AdminRebuildIndexResponse> {
    const { indexName } = request;

    const startTime = Date.now();

    const limit = Math.min(request.limit, 128);
    const filterIndexId = IndexId[indexName as keyof typeof IndexId];
    const prefix = 'crl.r.';
    const start = request.inclusive ? `${prefix}${request.start}` : undefined;
    const startAfter = request.inclusive ? undefined : `${prefix}${request.start}`;
    console.log(`computeRebuildIndexResponse: list storage: ${JSON.stringify({ prefix, start, startAfter, limit })}`);
    const map = await storage.list({ prefix, start, startAfter, limit });
    const newIndexRecords = new Map<IndexId, Record<string, DurableObjectStorageValue>>();
    let count = 0;
    let first: string | undefined;
    let last: string | undefined;
    for (const [ key, value ] of map) {
        if (typeof value !== 'string') throw new Error(`Bad value: ${value} for key ${key}`);
        const obj = attNums.unpackRecord(value);
        const [ _, timestampAndUuid, timestamp, uuid ] = checkMatches('key', key, /^crl\.r\.((.+?)-(.+?))$/);
        if (!isValidTimestamp(timestamp) || !isValidUuid(uuid)) throw new Error(`Bad key: ${key}`);
        await computeIndexRecords(obj, timestamp, timestampAndUuid, key, newIndexRecords, filterIndexId);
        if (count === 0) first = timestampAndUuid;
        last = timestampAndUuid;
        count++;
    }
    if (newIndexRecords.size > 0) {
        await storage.transaction(async txn => {
            if (newIndexRecords.size > 0) {
                for (const [ indexId, records ] of newIndexRecords) {
                    console.log(`computeRebuildIndexResponse: Saving ${Object.keys(records).length} ${IndexId[indexId]} index records (first=${JSON.stringify(Object.entries(records).at(0))})`);
                    await txn.put(records);
                }
            }
        });
    }
    const rt: AdminRebuildIndexResponse = { kind: 'admin-rebuild-index', millis: Date.now() - startTime, count, first, last };
    console.log(`computeRebuildIndexResponse: returning: ${JSON.stringify(rt)}`);
    return rt;
}

//

interface SourceState {
    readonly doName: string;
    readonly haveTimestampId?: string;
    readonly notificationTimestampId?: string;
    readonly notificationFromColo?: string;
    readonly notificationTime?: string; // instant
}

// deno-lint-ignore no-explicit-any
function isValidSourceState(obj: any): obj is SourceState {
    return isStringRecord(obj)
        && typeof obj.doName === 'string'
        && (obj.haveTimestampId === undefined || typeof obj.haveTimestampId === 'string')
        && (obj.notificationTimestampId === undefined || typeof obj.notificationTimestampId === 'string')
        && (obj.notificationFromColo === undefined || typeof obj.notificationFromColo === 'string')
        && (obj.notificationTime === undefined || typeof obj.notificationTime === 'string')
        ;
}

export enum IndexId {
    UrlSha256 = 1,
    UserAgent = 2,
    Referer = 3,
    Range = 4,
    HashedIpAddress = 5,
    EdgeColo = 6,
    DoColo = 7,
    Source = 8,
    Ulid = 9,
    Method = 10,
    Uuid = 11,
    DayUrl = 12,
}

export const INDEX_DEFINITIONS: [ string, IndexId, (v: string, timestamp: string) => string | undefined | Promise<string | undefined> ][] = [
    [ 'url', IndexId.UrlSha256, async (v: string) => (await Bytes.ofUtf8(v).sha256()).hex() ],
    [ 'userAgent', IndexId.UserAgent, (v: string) => v.substring(0, 1024) ],
    [ 'referer', IndexId.Referer, (v: string) => v.substring(0, 1024) ],
    [ 'range', IndexId.Range, (v: string) => v.substring(0, 1024) ],
    [ 'hashedIpAddress', IndexId.HashedIpAddress, unpackHashedIpAddressHash ],
    [ 'other.colo', IndexId.EdgeColo, v => v ],
    [ 'doColo', IndexId.DoColo, v => v ],
    [ 'source', IndexId.Source, v => v ],
    [ 'ulid', IndexId.Ulid, v => v.substring(0, 1024) ],
    [ 'method', IndexId.Method, v => v === 'GET' ? undefined : v.substring(0, 1024) ], // vast majority will be GET, only the other ones are interesting
    [ 'uuid', IndexId.Uuid, v => v ],
    [ 'url', IndexId.DayUrl, (v, timestamp) => `${timestamp.substring(0, 6)}.${v.substring(0, 1024)}` ],
];

//

async function computeIndexRecords(record: Record<string, string>, timestamp: string, timestampAndUuid: string, key: string, outIndexRecords: Map<IndexId, Record<string, DurableObjectStorageValue>>, filterIndexId?: IndexId) {
    for (const [ property, indexId, indexValueFn ] of INDEX_DEFINITIONS) {
        if (filterIndexId && filterIndexId !== indexId) continue;
        const value = record[property];
        if (typeof value !== 'string') continue;
        const indexValueValueOrPromise = indexValueFn(value, timestamp);
        const indexValue = typeof indexValueValueOrPromise === 'object' ? await indexValueValueOrPromise : indexValueValueOrPromise;
        if (typeof indexValue !== 'string') continue;
        const indexRecords = getOrInit(outIndexRecords, indexId, () => ({} as Record<string, DurableObjectStorageValue>));
        indexRecords[`crl.i0.${indexId}.${indexValue}.${timestampAndUuid}`] = { key };
    }
}
