import { DurableObjectStorage } from './deps.ts';
import { isStringRecord } from './check.ts';
import { AlarmPayload, RpcClient } from './rpc_model.ts';
import { AttNums } from './att_nums.ts';
import { isValidTimestamp, timestampToInstant } from './timestamp.ts';
import { isValidUuid } from './uuid.ts';

export class AllRawRequestController {
    static readonly processAlarmKind = 'AllRawRequestController.processAlarmKind';

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
        await storage.put(`arr.ss.${doName}`, newState);

        await storage.transaction(async txn => {
            await txn.put('alarm.payload', { kind: AllRawRequestController.processAlarmKind } as AlarmPayload);
            await txn.setAlarm(Date.now());
        });
    }

    async process(): Promise<void> {
        const { storage, rpcClient } = this;

        // load and save new records from all sources
        const map = await storage.list({ prefix: 'arr.ss.'});
        console.log(`AllRawRequestController: process: ${map.size} source states`);

        const attNums = await this.getOrLoadAttNums();

        for (const state of map.values()) {
            if (!isValidSourceState(state)) {
                console.warn(`AllRawRequestController: Skipping bad SourceState record: ${JSON.stringify(state)}`);
                continue;
            }
            await processSource(state, rpcClient, attNums, storage);
        }
    }

    async listSources(): Promise<Record<string, unknown>[]> {
        const map = await this.storage.list({ prefix: 'arr.ss.' });
        return [...map.values()].filter(isStringRecord);
    }

    async listRecords(): Promise<Record<string, unknown>[]> {
        const attNums = await this.getOrLoadAttNums();

        const map = await this.storage.list({ prefix: 'arr.r.', limit: 200 });
        const rt: Record<string, unknown>[] = [];
        for (const [ key, record ] of map) {
            if (typeof record === 'string') {
                const obj = attNums.unpackRecord(record);
                rt.push({ 
                    key: key.substring('arr.r.'.length),
                    time: timestampToInstant(obj.timestamp),
                    ...obj,
                    encryptedIpAddress: undefined });
            }
        }
        return rt;
    }

    //

    private async getOrLoadAttNums(): Promise<AttNums> {
        if (!this.attNums) this.attNums = await loadAttNums(this.storage);
        return this.attNums;
    }

}

//

async function loadSourceState(doName: string, storage: DurableObjectStorage): Promise<SourceState | undefined> {
    const state = await storage.get(`arr.ss.${doName}`);
    if (state !== undefined && !isValidSourceState(state)) {
        console.warn(`AllRawRequestController: Invalid source state for ${doName}: ${JSON.stringify(state)}`);
        return undefined;
    }
    return state;
}

async function loadAttNums(storage: DurableObjectStorage): Promise<AttNums> {
    const record = await storage.get('arr.attNums');
    console.log(`AllRawRequestController: loadAttNums: ${JSON.stringify(record)}`);
    try {
        if (record !== undefined) return AttNums.fromJson(record);
    } catch (e) {
        console.error(`AllRawRequestController: Error loading AttNums from record ${JSON.stringify(record)}: ${e.stack || e}`);
    }
    return new AttNums();
}

async function processSource(state: SourceState, rpcClient: RpcClient, attNums: AttNums, storage: DurableObjectStorage) {
    const { doName } = state;
    console.log(`AllRawRequestController: processSource ${doName}: ${JSON.stringify(state)}`);

    // fetch some new records from the source DO
    const startAfterTimestampId = state.haveTimestampId;
    const { namesToNums, records } = await rpcClient.getNewRawRequests({ limit: 128, startAfterTimestampId }, doName);
    console.log(`${Object.keys(records).length} records`);

    const sourceAttNums = new AttNums(namesToNums);
    const maxBefore = attNums.max();
    const newRecords: Record<string, string> = {};
    let maxTimestampId = startAfterTimestampId;
    for (const [ timestampId, sourceRecord ] of Object.entries(records)) {
        if (maxTimestampId === undefined || timestampId > maxTimestampId) maxTimestampId = timestampId;
        const obj = sourceAttNums.unpackRecord(sourceRecord);
        // console.log(`${timestampId}: ${JSON.stringify(obj)}`);
        const { uuid, timestamp } = obj;
        if (typeof uuid !== 'string' || !isValidUuid(uuid)) {
            console.warn(`AllRawRequestController: Skipping bad source obj (invalid uuid): ${JSON.stringify(obj)}`);
            continue;
        }
        if (typeof timestamp !== 'string' || !isValidTimestamp(timestamp)) {
            console.warn(`AllRawRequestController: Skipping bad source obj (invalid timestamp): ${JSON.stringify(obj)}`);
            continue;
        }
        const key = `arr.r.${timestamp}-${uuid}`;
        obj.source = doName;
        const record = attNums.packRecord(obj);
        newRecords[key] = record;
    }
    if (attNums.max() > maxBefore) {
        await storage.put('arr.attNums', attNums.toJson());
    }
    if (Object.keys(newRecords).length > 0 || maxTimestampId !== startAfterTimestampId) {
        const newState: SourceState = { ...state, haveTimestampId: maxTimestampId };
        await storage.transaction(async txn => {
            if (Object.keys(newRecords).length > 0) {
                console.log(`AllRawRequestController: Saving ${Object.keys(newRecords).length} imported records from ${doName}`);
                await txn.put(newRecords);
            }
            if (maxTimestampId !== startAfterTimestampId) {
                console.log(`AllRawRequestController: Updating haveTimestampId from ${startAfterTimestampId} to ${maxTimestampId} for ${doName}`);
                await txn.put(`arr.ss.${doName}`, newState);
            }
        });
    }
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
