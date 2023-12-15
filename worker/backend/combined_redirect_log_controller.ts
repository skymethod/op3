import { Bytes, chunk, DurableObjectStorage, DurableObjectStorageValue } from '../deps.ts';
import { checkMatches, isStringRecord } from '../check.ts';
import { AdminDataRequest, AdminDataResponse, AdminRebuildIndexRequest, AdminRebuildIndexResponse, AlarmPayload, isUrlInfo, PackedRedirectLogsResponse, QueryPackedRedirectLogsRequest, QueryRedirectLogsRequest, RpcClient, Unkinded, UrlInfo, UrlsExternalNotification } from '../rpc_model.ts';
import { AttNums } from './att_nums.ts';
import { computeTimestamp, isValidTimestamp, timestampToEpochMillis, timestampToInstant } from '../timestamp.ts';
import { isValidUuid } from '../uuid.ts';
import { getOrInit } from '../maps.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { queryCombinedRedirectLogs } from './combined_redirect_log_query.ts';
import { consoleError, consoleWarn, writeTraceEvent } from '../tracer.ts';
import { newTextResponse } from '../responses.ts';
import { computeServerUrl } from '../client_params.ts';
import { computeListOpts } from './storage.ts';
import { DoNames } from '../do_names.ts';
import { IpAddressHashingFn } from './redirect_log_controller.ts';

export class CombinedRedirectLogController {
    static readonly processAlarmKind = 'CombinedRedirectLogController.processAlarmKind';

    private readonly durableObjectName: string;
    private readonly storage: DurableObjectStorage;
    private readonly rpcClient: RpcClient;
    private readonly sourceStateCache = new Map<string, SourceState>();
    private readonly knownExistingUrls = new Set<string>();
    private readonly hashIpAddress: IpAddressHashingFn;

    private attNums?: AttNums;
    private mostBehindTimestampId?: string;
    private urlNotificationsEnabled = true;
    private urlNotificationsLastSent?: string; // instant
    private knownExistingUrlsMax = 200;
    private init = false;

    constructor(storage: DurableObjectStorage, rpcClient: RpcClient, durableObjectName: string, hashIpAddress: IpAddressHashingFn) {
        this.storage = storage;
        this.rpcClient = rpcClient;
        this.durableObjectName = durableObjectName;
        this.hashIpAddress = hashIpAddress;
    }

    async getState() {
        await this.ensureInit();
        const { knownExistingUrls, knownExistingUrlsMax, mostBehindTimestampId, urlNotificationsEnabled, urlNotificationsLastSent } = this;
        let unsentNotifcations = undefined;
        try {
            const map = await this.storage.list({ prefix: 'crl.un0.' });
            unsentNotifcations = map.size;
        } catch {
            // noop
        }
        return { 
            knownExistingUrlsSize: knownExistingUrls.size,
            knownExistingUrlsMax,
            mostBehindTimestampId,
            urlNotificationsEnabled,
            urlNotificationsLastSent,
            unsentNotifcations,
        }
    }

    async updateState(state: Record<string, string>): Promise<string[]> {
        await this.ensureInit();
        const { storage } = this;
        const stateObj = await storage.get('state') ?? {};
        if (!isStringRecord(stateObj)) throw new Error(`Unexpected state obj; ${JSON.stringify(stateObj)}`);
        const { urlNotificationsEnabled, knownExistingUrlsMax } = state;
        const rt: string[] = [];
        if (urlNotificationsEnabled === 'true') {
            if (!this.urlNotificationsEnabled) {
                stateObj.urlNotificationsEnabled = true;
                this.urlNotificationsEnabled = true;
                this.urlNotificationsLastSent = undefined;
                this.knownExistingUrls.clear();
                rt.push('Enabled url notifications');
            }
        } else if (urlNotificationsEnabled === 'false') {
            if (this.urlNotificationsEnabled) {
                stateObj.urlNotificationsEnabled = false;
                this.urlNotificationsEnabled = false;
                this.urlNotificationsLastSent = undefined;
                this.knownExistingUrls.clear();
                rt.push('Disabled url notifications');
            }
        }
        if (/^\d+$/.test(knownExistingUrlsMax)) {
            const oldValue = this.knownExistingUrlsMax;
            const newValue = parseInt(knownExistingUrlsMax);
            if (newValue !== oldValue) {
                stateObj.knownExistingUrlsMax = newValue;
                this.knownExistingUrlsMax = newValue;
                this.knownExistingUrls.clear();
                rt.push(`Changed knownExistingUrlsMax from ${oldValue} to ${newValue}`);
            }
        }
        if (rt.length > 0) {
            await storage.put('state', stateObj);
        }
        return rt;
    }

    async receiveNotification(opts: { doName: string; timestampId: string; fromColo: string; }) {
        await this.ensureInit();
        const { doName, timestampId, fromColo } = opts;
        const { storage, durableObjectName } = this;

        // update source state
        const notificationTime = new Date().toISOString();
        const oldState = await loadSourceState(doName, storage);
        const newState = { ...oldState, doName, notificationTimestampId: timestampId, notificationFromColo: fromColo, notificationTime };
        await storage.put(`crl.ss.${doName}`, newState);
        this.updateSourceStateCache(newState);

        const setAlarm = await storage.transaction(async txn => {
            // const existing = await txn.getAlarm();
            const now = Date.now();
            // if (typeof existing === 'number' && (existing - now) < (10 * 1000)) {
            //     // we are already scheduled in the near future
            //     return false;
            // }
            await txn.put('alarm.payload', { kind: CombinedRedirectLogController.processAlarmKind } as AlarmPayload);
            await txn.setAlarm(now);
            return true;
        });
        if (setAlarm) writeTraceEvent({ kind: 'storage-write', durableObjectName, spot: 'crlc.receive-notification', alarms: 1 });
    }

    async process(): Promise<void> {
        await this.ensureInit();
        const { storage, rpcClient, knownExistingUrls, knownExistingUrlsMax, urlNotificationsEnabled } = this;

        // load and save new records from all sources
        const sourceStates = await loadSourceStates(storage);
        console.log(`CombinedRedirectLogController: process: ${sourceStates.length} source states`);

        this.updateSourceStateCache(sourceStates);

        const attNums = await this.getOrLoadAttNums();
        
        const multiples = Object.fromEntries([
            [ DoNames.redirectLogForColo('MIA'), 14 ],
            [ DoNames.redirectLogForColo('AMS'), 6 ],
            [ DoNames.redirectLogForColo('ORD'), 2 ],
            [ DoNames.redirectLogForColo('SEA'), 2 ],
        ]);

        for (const state of sourceStates) {
            const times = multiples[state.doName] ?? 1;
            let currentState = state;
            for (let i = 0; i < times; i++) {
                const newState = await processSource(currentState, rpcClient, attNums, storage, knownExistingUrls, knownExistingUrlsMax, urlNotificationsEnabled);
                if (newState) {
                    this.updateSourceStateCache(newState);
                    currentState = newState;
                } else {
                    break;
                }
            }
        }

        if (this.urlNotificationsEnabled) {
            await this.sendPendingUrlNotifications();
        }
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        await this.ensureInit();
        const { operationKind, targetPath, parameters = {} } = req;
     
        if (operationKind === 'select' && targetPath === '/crl/sources') {
            const map = await this.storage.list(computeListOpts('crl.ss.', parameters));
            const results = [...map.values()].filter(isStringRecord);
            return { results };
        }

        if (operationKind === 'select' && targetPath === '/crl/attnums') {
            const attNums = await this.getOrLoadAttNums();
            return { results: [ attNums.toJson() ] };
        }

        if (operationKind === 'select' && targetPath === '/crl/records') {
            const { format } = parameters;
            const formatPacked = format === 'packed';
            const attNums = await this.getOrLoadAttNums();
            const map = await this.storage.list(computeListOpts('crl.r.', parameters));
            const results: unknown[] = [];
            for (const [ key, record ] of map) {
                if (typeof record === 'string') {
                    if (formatPacked) {
                        results.push(attNums.removingPackedAtt(record, 'encryptedIpAddress'));
                    } else {
                        const obj = attNums.unpackRecord(record);
                        results.push({ 
                            _key: key.substring('crl.r.'.length),
                            time: timestampToInstant(obj.timestamp),
                            ...obj,
                            encryptedIpAddress: undefined });
                    }
                }
            }
            return { results };
        }

        const m = /^\/crl\/indexes\/(\d+)$/.exec(targetPath);
        if (m && (operationKind === 'select' || operationKind === 'delete')) {
            const indexId = parseInt(m[1]);
            if (typeof parameters.limit !== 'string') throw new Error(`Must provide a limit`);
            const map = await this.storage.list(computeListOpts(`crl.i0.${indexId}.`, parameters));
            if (operationKind === 'select') {
                const results: unknown[] = [];
                for (const [ key, value ] of map) {
                    const obj = isStringRecord(value) ? value : { _unknown: value };
                    obj._key = key;
                    results.push(obj);
                }
                return { results };
            }
            if (operationKind === 'delete') {
                const allowedToDelete = [ IndexId.Uuid, IndexId.EdgeColo, IndexId.DoColo, IndexId.Source, IndexId.Range ];
                if (!allowedToDelete.includes(indexId)) throw new Error(`Not allowed to delete index ${indexId}`);
                const keys = [...map.keys()];
                const firstKey = keys.at(0);
                const lastKey = keys.at(-1);
                let toDelete = 0;
                let deleted = 0;
                let deleteCalls = 0;
                for (const batch of chunk(keys, 128)) {
                    toDelete += batch.length;
                    deleted += await this.storage.delete(batch);
                    deleteCalls++;
                }
                const results = [ { firstKey, lastKey, keys: keys.length, toDelete, deleted, deleteCalls } ];
                return { results };
            }
        }

        throw new Error(`Unsupported crl-related query`);
    }

    async queryRedirectLogs(request: Unkinded<QueryRedirectLogsRequest>): Promise<Response> {
        await this.ensureInit();
        const attNums = await this.getOrLoadAttNums();
        const mostBehindTimestamp = typeof this.mostBehindTimestampId === 'string' ? this.mostBehindTimestampId.substring(0, 15) : undefined;
        return await queryCombinedRedirectLogs(request, mostBehindTimestamp, attNums, this.storage, this.hashIpAddress);
    }

    async queryPackedRedirectLogs(request: Unkinded<QueryPackedRedirectLogsRequest>): Promise<PackedRedirectLogsResponse> {
        await this.ensureInit();
        const attNums = await this.getOrLoadAttNums();
        const { limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, startAfterRecordKey } = request;
        const records: Record<string, string> = {}; // timestampId -> packed record
        const prefix = 'crl.r.';
        const startAfter = startAfterRecordKey ? `${prefix}${startAfterRecordKey}` : startTimeExclusive ? `${prefix}${computeTimestamp(startTimeExclusive)}` : undefined;
        const start = startAfter ? undefined : startTimeInclusive ? `${prefix}${computeTimestamp(startTimeInclusive)}` : undefined; // list() cannot be called with both start and startAfter values
        const end = endTimeExclusive ? `${prefix}${computeTimestamp(endTimeExclusive)}` : undefined;
        const map = await this.storage.list({ prefix, limit, start, startAfter, end });
        for (const [ key, record ] of map) {
            if (typeof record === 'string') {
                const timestampId = key.substring(prefix.length);
                records[timestampId] = record;
            }
        }
        return { kind: 'packed-redirect-logs', namesToNums: attNums.toJson(), records };
    }

    async rebuildIndex(request: Unkinded<AdminRebuildIndexRequest>): Promise<AdminRebuildIndexResponse> {
        await this.ensureInit();
        const attNums = await this.getOrLoadAttNums();
        return computeRebuildIndexResponse(request, attNums, this.storage);
    }

    async getMetrics(): Promise<Response> {
        await this.ensureInit();
        if (this.sourceStateCache.size === 0) {
            const states = await loadSourceStates(this.storage);
            this.updateSourceStateCache(states);
        }

        const lines: string[] = [];
        const time = Date.now();
        {
            const id = 'crlc_source_state_behind_seconds';
            lines.push(`# HELP ${id} source states by how far behind`, `# TYPE ${id} gauge`);
            for (const { doName, notificationTimestampId, haveTimestampId } of this.sourceStateCache.values()) {
                if (typeof notificationTimestampId === 'string' && typeof haveTimestampId === 'string') {
                    const notificationTime = timestampToEpochMillis(notificationTimestampId.substring(0, 15));
                    const haveTime = timestampToEpochMillis(haveTimestampId.substring(0, 15));
                    const behind = Math.round(Math.max(notificationTime - haveTime, 0) / 1000);
                    lines.push(`${id}{source="${doName}"} ${behind} ${time}`);
                }
            }
        }

        lines.push('');
        const id = 'crlc_most_behind_timestamp_seconds';
        lines.push(`# HELP ${id} most behind timestamp how far behind`, `# TYPE ${id} gauge`);
        let behind = 0;
        if (typeof this.mostBehindTimestampId === 'string') {
            const mostBehindTime = timestampToEpochMillis(this.mostBehindTimestampId.substring(0, 15));
            behind = Math.round(Math.max(time - mostBehindTime, 0) / 1000);
        }
        lines.push(`${id} ${behind} ${time}`);
        lines.push('');

        return newTextResponse(lines.join('\n'));
    }

    //

    private async ensureInit() {
        if (this.init) return;
        const obj = await this.storage.get('state');
        if (isStringRecord(obj)) {
            const { urlNotificationsEnabled, knownExistingUrlsMax } = obj;
            if (typeof urlNotificationsEnabled === 'boolean') {
                this.urlNotificationsEnabled = urlNotificationsEnabled;
            }
            if (typeof knownExistingUrlsMax === 'number') {
                this.knownExistingUrlsMax = knownExistingUrlsMax;
            }
        }
        this.init = true;
    }

    private async getOrLoadAttNums(): Promise<AttNums> {
        if (!this.attNums) this.attNums = await loadAttNums(this.storage);
        return this.attNums;
    }

    private updateSourceStateCache(stateOrAllStates: SourceState | readonly SourceState[]) {
        for (const state of Array.isArray(stateOrAllStates) ? stateOrAllStates : [ stateOrAllStates ]) {
            this.sourceStateCache.set(state.doName, state);
        }
        this.recomputeMostBehindTimestampId();
    }

    private recomputeMostBehindTimestampId() {
        let maxBehind = 0;
        let rt: string | undefined;
        for (const { notificationTimestampId, haveTimestampId } of this.sourceStateCache.values()) {
            if (typeof notificationTimestampId === 'string' && typeof haveTimestampId === 'string') {
                const notificationTime = timestampToEpochMillis(notificationTimestampId.substring(0, 15));
                const haveTime = timestampToEpochMillis(haveTimestampId.substring(0, 15));
                const behind = Math.round(Math.max(notificationTime - haveTime, 0) / 1000);
                if (behind > maxBehind) {
                    rt = haveTimestampId;
                    maxBehind = behind;
                }
            }
        }
        this.mostBehindTimestampId = rt;
    }

    private async sendPendingUrlNotifications() {
        const { storage, rpcClient, durableObjectName, urlNotificationsLastSent } = this;
        
        // only flush them once a minute
        if (typeof urlNotificationsLastSent === 'string' && (Date.now() - new Date(urlNotificationsLastSent).getTime() < 1000 * 60)) return;

        const time = new Date().toISOString();
        this.urlNotificationsLastSent = time;

        try {
            const map = await storage.list({ prefix: 'crl.un0.', limit: 50 });
            if (map.size > 0) {
                const urls = [...map.values()].filter(isUrlInfo);
                const notification: UrlsExternalNotification = {
                    type: 'urls',
                    sender: durableObjectName,
                    sent: time,
                    urls,
                };
                console.log(`CombinedRedirectLogController: Sending notification with ${urls.length} urls`);
                await rpcClient.receiveExternalNotification({ received: time, notification }, DoNames.showServer);
                const newUrlRecords = Object.fromEntries(urls.map(v => [ computeUrlKey(v.url), v ]));
                await storage.transaction(async tx => {
                    await tx.put(newUrlRecords);
                    await tx.delete([...map.keys()]);
                });
            }
        } catch (e) {
            consoleError('crlc-send-url-not', `CombinedRedirectLogController: Error sending pending url notifications: ${e.stack || e}`);
        }
    }
}

//

async function loadSourceStates(storage: DurableObjectStorage): Promise<readonly SourceState[]> {
    const rt: SourceState[] = [];
    const map = await storage.list({ prefix: 'crl.ss.'});
    for (const state of map.values()) {
        if (!isValidSourceState(state)) {
            consoleWarn('crlc-bad-ss', `CombinedRedirectLogController: Skipping bad SourceState record: ${JSON.stringify(state)}`);
            continue;
        }
        rt.push(state);
    }
    return rt;
}

async function loadSourceState(doName: string, storage: DurableObjectStorage): Promise<SourceState | undefined> {
    const state = await storage.get(`crl.ss.${doName}`);
    if (state !== undefined && !isValidSourceState(state)) {
        consoleWarn('crlc-load-bad-ss', `CombinedRedirectLogController: Invalid source state for ${doName}: ${JSON.stringify(state)}`);
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
        consoleError('crlc-loading-attnums', `CombinedRedirectLogController: Error loading AttNums from record ${JSON.stringify(record)}: ${e.stack || e}`);
    }
    return new AttNums();
}

async function processSource(state: SourceState, rpcClient: RpcClient, attNums: AttNums, storage: DurableObjectStorage, knownExistingUrls: Set<string>, knownExistingUrlsMax: number, urlNotificationsEnabled: boolean): Promise<SourceState | undefined> {
    const { doName } = state;
    const nothingNew = typeof state.notificationTimestampId === 'string' && typeof state.haveTimestampId === 'string' && state.haveTimestampId >= state.notificationTimestampId;
    if (nothingNew) return;

    console.log(`CombinedRedirectLogController: processSource ${doName}: ${JSON.stringify(state)}`);

    // fetch some new records from the source DO
    const startAfterTimestampId = state.haveTimestampId;
    const { namesToNums, records } = await rpcClient.getNewRedirectLogs({ limit: 10, startAfterTimestampId }, doName);
    console.log(`${Object.keys(records).length} records`);

    const sourceAttNums = new AttNums(namesToNums);
    const maxBefore = attNums.max();
    const newRecords: Record<string, string> = {};
    const newIndexRecords = new Map<IndexId, Record<string, DurableObjectStorageValue>>();
    const newPendingUrlNotificationRecords: Record<string, UrlInfo> = {};
    let maxTimestampId = startAfterTimestampId;
    for (const [ timestampId, sourceRecord ] of Object.entries(records)) {
        if (maxTimestampId === undefined || timestampId > maxTimestampId) maxTimestampId = timestampId;
        const obj = sourceAttNums.unpackRecord(sourceRecord);
        // console.log(`${timestampId}: ${JSON.stringify(obj)}`);
        const { uuid, timestamp } = obj;
        if (typeof uuid !== 'string' || !isValidUuid(uuid)) {
            consoleWarn('crlc-bad-source-obj-uuid', `CombinedRedirectLogController: Skipping bad source obj (invalid uuid): ${JSON.stringify(obj)}`);
            continue;
        }
        if (typeof timestamp !== 'string' || !isValidTimestamp(timestamp)) {
            consoleWarn('crlc-bad-source-obj-timestamp', `CombinedRedirectLogController: Skipping bad source obj (invalid timestamp): ${JSON.stringify(obj)}`);
            continue;
        }
        const timestampAndUuid = `${timestamp}-${uuid}`;
        const key = `crl.r.${timestampAndUuid}`;
        obj.source = doName;
        await computeIndexRecords(obj, timestamp, timestampAndUuid, key, newIndexRecords);
        if (urlNotificationsEnabled) await computePendingUrlNotificationRecords(obj, timestamp, storage, knownExistingUrls, knownExistingUrlsMax, newPendingUrlNotificationRecords);
        const record = attNums.packRecord(obj);
        newRecords[key] = record;
    }
    if (attNums.max() > maxBefore) {
        await storage.put('crl.attNums', attNums.toJson());
    }
    let newState: SourceState | undefined;
    if (Object.keys(newRecords).length > 0 || newIndexRecords.size > 0 || maxTimestampId !== startAfterTimestampId || Object.keys(newPendingUrlNotificationRecords).length > 0) {
        // two transactions to stay under 128
        // it's ok if this first transaction runs more than once

        // first, save data records and pending url notifications
        await storage.transaction(async txn => {
            if (Object.keys(newRecords).length > 0) {
                console.log(`CombinedRedirectLogController: Saving ${Object.keys(newRecords).length} imported records from ${doName}`);
                await txn.put(newRecords);
            }
            if (Object.keys(newPendingUrlNotificationRecords).length > 0) {
                console.log(`CombinedRedirectLogController: Saving ${Object.keys(newPendingUrlNotificationRecords).length} pending url notifications`);
                await txn.put(newPendingUrlNotificationRecords);
            }
        });

        // then, save index records and update source state
        await storage.transaction(async txn => {
            if (newIndexRecords.size > 0) {
                for (const [ indexId, records ] of newIndexRecords) {
                    console.log(`CombinedRedirectLogController: Saving ${Object.keys(records).length} ${IndexId[indexId]} index records from ${doName}`);
                    await txn.put(records);
                }
            }
            if (maxTimestampId !== startAfterTimestampId) {
                console.log(`CombinedRedirectLogController: Updating haveTimestampId from ${startAfterTimestampId} to ${maxTimestampId} for ${doName}`);
                newState = { ...state, haveTimestampId: maxTimestampId };
                await txn.put(`crl.ss.${doName}`, newState);
            }
        });
    }
    return newState;
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
    XpsId = 13,
}

export const INDEX_DEFINITIONS: [ string, IndexId, (v: string, timestamp: string) => string | undefined | Promise<string | undefined> ][] = [
    [ 'url', IndexId.UrlSha256, async (v: string) => (await Bytes.ofUtf8(computeServerUrl(v)).sha256()).hex() ],
    [ 'userAgent', IndexId.UserAgent, (v: string) => v.substring(0, 1024) ],
    [ 'referer', IndexId.Referer, (v: string) => v.substring(0, 1024) ],
    [ 'range', IndexId.Range, _ => undefined ], // disabled 2023-12-14  [ 'range', IndexId.Range, (v: string) => v.substring(0, 1024) ]
    [ 'hashedIpAddress', IndexId.HashedIpAddress, unpackHashedIpAddressHash ],
    [ 'other.colo', IndexId.EdgeColo, _ => undefined ], // disabled 2023-02-12 [ 'other.colo', IndexId.EdgeColo, v => v ],
    [ 'doColo', IndexId.DoColo, _ => undefined ], // disabled 2023-02-12 [ 'doColo', IndexId.DoColo, v => v ],
    [ 'source', IndexId.Source, _ => undefined ], // disabled 2023-02-12 [ 'source', IndexId.Source, v => v ],
    [ 'ulid', IndexId.Ulid, v => v.substring(0, 1024) ],
    [ 'method', IndexId.Method, v => v === 'GET' ? undefined : v.substring(0, 1024) ], // vast majority will be GET, only the other ones are interesting
    [ 'uuid', IndexId.Uuid, _ => undefined ], // disabled 2023-02-10 [ 'uuid', IndexId.Uuid, v => v ],
    [ 'url', IndexId.DayUrl, (v, timestamp) => `${timestamp.substring(0, 6)}.${computeServerUrl(v).substring(0, 1024)}` ],
    [ 'xpsId', IndexId.XpsId, (v: string) => v.substring(0, 1024) ],
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

async function computePendingUrlNotificationRecords(record: Record<string, string>, timestamp: string, storage: DurableObjectStorage, knownExistingUrls: Set<string>, knownExistingUrlsMax: number, outPendingUrlNotificationRecords: Record<string, UrlInfo>) {
    const { url: clientUrl } = record;
    if (clientUrl !== undefined && typeof clientUrl !== 'string') {
        consoleWarn('crlc-bad-source-obj-url', `CombinedRedirectLogController: Skipping pending url for bad source obj (invalid url): ${JSON.stringify(record)}`);
        return;
    }

    const url = computeServerUrl(clientUrl);
    if (knownExistingUrls.has(url)) return;

    const alreadyPending = Object.values(outPendingUrlNotificationRecords).some(v => v.url === url);
    if (alreadyPending) return;

    const existing = await storage.get(computeUrlKey(url));
    if (existing === undefined) {
        const unKey = `crl.un0.${url.substring(0, 1024)}`;
        const existing = await storage.get(unKey); 
        if (existing === undefined) {
            const found = timestampToInstant(timestamp);
            outPendingUrlNotificationRecords[unKey] = { url, found };
        }
    } else {
        if (knownExistingUrls.size >= knownExistingUrlsMax) knownExistingUrls.clear(); // only keep a limited number of the latest urls around in memory
        knownExistingUrls.add(url);
    }
}

function computeUrlKey(url: string): string {
    return `crl.u0.${url.substring(0, 1024)}`;
}
