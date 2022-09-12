import { DurableObjectStorage } from './deps.ts';
import { isStringRecord } from './check.ts';

export class AllRawRequestController {
    static readonly processNotificationAlarmKind = 'process-notification';

    private readonly storage: DurableObjectStorage;

    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
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
            await txn.put('alarm.input', { kind: AllRawRequestController.processNotificationAlarmKind });
            await txn.setAlarm(Date.now());
        });
    }

}

//

async function loadSourceState(doName: string, storage: DurableObjectStorage): Promise<SourceState | undefined> {
    const state = await storage.get(`ss.${doName}`);
    if (state !== undefined && !isValidSourceState(state)) {
        console.warn(`Invalid source state for ${doName}: ${JSON.stringify(state)}`);
        return undefined;
    }
    return state;
}

async function saveSourceState(state: SourceState, storage: DurableObjectStorage) {
    const { doName } = state;
    await storage.put(`ss.${doName}`, state);
}

//

interface SourceState {
    readonly doName: string;
    readonly notificationTimestampId?: string;
    readonly notificationFromColo?: string;
    readonly notificationTime?: string; // instant
}

// deno-lint-ignore no-explicit-any
function isValidSourceState(obj: any): obj is SourceState {
    return isStringRecord(obj)
        && typeof obj.doName === 'string'
        && (obj.notificationTimestampId === undefined || typeof obj.notificationTimestampId === 'string')
        && (obj.notificationFromColo === undefined || typeof obj.notificationFromColo === 'string')
        && (obj.notificationTime === undefined || typeof obj.notificationTime === 'string')
        ;
}
