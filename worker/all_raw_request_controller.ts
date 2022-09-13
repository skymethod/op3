import { DurableObjectStorage } from './deps.ts';
import { isStringRecord } from './check.ts';
import { AlarmPayload, RpcClient } from './rpc_model.ts';
import { AttNums } from './att_nums.ts';

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
        await saveSourceState(newState, storage);

        await storage.transaction(async txn => {
            await txn.put('alarm.payload', { kind: AllRawRequestController.processAlarmKind } as AlarmPayload);
            await txn.setAlarm(Date.now());
        });
    }

    async process(): Promise<void> {
        const { storage, rpcClient } = this;

        const map = await storage.list({ prefix: 'arr.ss.'});
        console.log(`process: ${map.size} source states`);
        // TODO load and save new records from all sources
        const limit = 128;
        for (const [ key, value ] of map) {
            const source = key.substring('arr.ss.'.length);
            if (isValidSourceState(value)) {
                console.log(`${source}: ${JSON.stringify(value)}`);
                const startAfterTimestampId = value.haveTimestampId;
                const { namesToNums, records } = await rpcClient.getNewRawRequests({ limit, startAfterTimestampId }, source);
                console.log(`${Object.keys(records).length} records`);
                const sourceAttNums = new AttNums(namesToNums);
                for (const [ timestampId, record ] of Object.entries(records)) {
                    const obj = sourceAttNums.unpackRecord(record);
                    console.log(`${timestampId}: ${JSON.stringify(obj)}`);
                }
            }
        }
    }

    private async getOrLoadAttNums(): Promise<AttNums> {
        if (!this.attNums) this.attNums = await loadAttNums(this.storage);
        return this.attNums;
    }

}

//

async function loadSourceState(doName: string, storage: DurableObjectStorage): Promise<SourceState | undefined> {
    const state = await storage.get(`arr.ss.${doName}`);
    if (state !== undefined && !isValidSourceState(state)) {
        console.warn(`Invalid source state for ${doName}: ${JSON.stringify(state)}`);
        return undefined;
    }
    return state;
}

async function saveSourceState(state: SourceState, storage: DurableObjectStorage) {
    const { doName } = state;
    await storage.put(`arr.ss.${doName}`, state);
}

async function loadAttNums(storage: DurableObjectStorage): Promise<AttNums> {
    const record = await storage.get('arr.attNums');
    console.log(`loadAttNums: ${JSON.stringify(record)}`);
    try {
        if (record !== undefined) return AttNums.fromJson(record);
    } catch (e) {
        console.error(`Error loading AttNums from record ${JSON.stringify(record)}: ${e.stack || e}`);
    }
    return new AttNums();
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
