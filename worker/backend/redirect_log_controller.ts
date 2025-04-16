import { check, tryParseInt } from '../check.ts';
import { DurableObjectStorage, chunk, Queue, distinct } from '../deps.ts';
import { DoNames } from '../do_names.ts';
import { tryParseRedirectLogRequest } from '../routes/admin_api.ts';
import { AdminDataRequest, AdminDataResponse, AlarmPayload, isRawRedirect, PackedRedirectLogs, RawRedirect, RpcClient, Unkinded } from '../rpc_model.ts';
import { addHours, computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { consoleError, writeTraceEvent } from '../tracer.ts';
import { AttNums } from './att_nums.ts';
import { IpAddressEncryptionFn, IpAddressHashingFn, computePutBatches } from './raw_redirects.ts';
import { computeListOpts } from './storage.ts';
import { TimestampSequence, unpackTimestampId } from './timestamp_sequence.ts';
import { sendWithRetries } from '../queues.ts'

export class RedirectLogController {
    static readonly notificationAlarmKind = 'RedirectLogController.notificationAlarmKind';

    private readonly storage: DurableObjectStorage;
    private readonly colo: string;
    private readonly doName: string;
    private readonly encryptIpAddress: IpAddressEncryptionFn;
    private readonly hashIpAddress: IpAddressHashingFn;
    private readonly notificationDelaySeconds: number;
    private readonly queue2?: Queue;

    private readonly timestampSequence = new TimestampSequence(3);
    private attNums: AttNums | undefined;
    private latestStartAfterTimestampId?: string;

    constructor(opts: { storage: DurableObjectStorage, colo: string, doName: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn, notificationDelaySeconds?: number, queue2: Queue | undefined }) {
        const { storage, colo, doName, encryptIpAddress, hashIpAddress, notificationDelaySeconds = 5, queue2 } = opts;
        check('notificationDelaySeconds', notificationDelaySeconds, v => v >= 0);

        this.storage = storage;
        this.colo = colo;
        this.doName = doName;
        this.encryptIpAddress = encryptIpAddress;
        this.hashIpAddress = hashIpAddress;
        this.notificationDelaySeconds = notificationDelaySeconds;
        this.queue2 = queue2;
    }

    async saveForLater(rawRedirects: readonly RawRedirect[]): Promise<void> {
        const { storage, timestampSequence, colo } = this;
        const timestampId = timestampSequence.next();
        await storage.put(computeSaveForLaterKey(timestampId), rawRedirects, { noCache: true });
        writeTraceEvent({ kind: 'generic', type: 'sfl', strings: [ colo, timestampId ], doubles: [ rawRedirects.length ] });
    }

    async save(rawRedirects: readonly RawRedirect[]): Promise<void> {
        const attNums = await this.getOrLoadAttNums();
        const attNumsMaxBefore = attNums.max();
        const batches = await computePutBatches(rawRedirects, attNums, this.colo, 'rlc', () => `rl.r.${this.timestampSequence.next()}`, this.encryptIpAddress, this.hashIpAddress);
        if (batches.length > 0) {
            await this.storage.transaction(async txn => {
                for (const batch of batches) {
                    await txn.put(batch);
                }
                if (attNums.max() !== attNumsMaxBefore) {
                    const record = attNums.toJson();
                    console.log(`saveAttNums: ${JSON.stringify(record)}`);
                    await txn.put('rl.attNums', record);
                }
            });
            await scheduleNotification(this.doName, this.notificationDelaySeconds, this.storage);
        }
    }

    async getNewRedirectLogs(opts: { limit: number, startAfterTimestampId?: string }): Promise<PackedRedirectLogs> {
        const { limit, startAfterTimestampId } = opts;
        const { storage } = this;
        const startAfter = startAfterTimestampId ? `rl.r.${startAfterTimestampId}` : undefined;
        const map = await storage.list({ prefix: `rl.r.`, startAfter, limit });
        const records: Record<string, string> = {};
        for (const [ key, value ] of map) {
            const timestampId = key.substring('rl.r.'.length);
            if (typeof value === 'string') records[timestampId] = value;
        }
        const attNums = await this.getOrLoadAttNums();
        const namesToNums = attNums.toJson();

        // update state.latestStartAfterTimestampId if necessary
        if (typeof startAfterTimestampId === 'string') {
            const latestStartAfterTimestampId = await this.getOrLoadLatestStartAfterTimestampId();
            if (latestStartAfterTimestampId !== startAfterTimestampId) {
                console.log(`RedirectLogController.latestStartAfterTimestampId ${latestStartAfterTimestampId} -> ${startAfterTimestampId}`);
                await storage.put('state.latestStartAfterTimestampId', startAfterTimestampId);
                this.latestStartAfterTimestampId = startAfterTimestampId;
            }
        }

        return { namesToNums, records };
    }

    static async sendNotification(input: Record<string, unknown>, opts: { fromColo: string, storage: DurableObjectStorage, rpcClient: RpcClient }) {
        console.log(`RedirectLogController.sendNotifcation: ${JSON.stringify(input)}`);
        const { storage, rpcClient, fromColo } = opts;
        const { doName } = input;
        if (typeof doName === 'string') {
            const timestampId = await queryLatestTimestampId(storage);
            if (timestampId) {
                await rpcClient.sendRedirectLogsNotification({ doName, timestampId, fromColo }, DoNames.combinedRedirectLog);
            }
        }
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        const { operationKind, targetPath, parameters = {} } = req;
        const r = tryParseRedirectLogRequest(targetPath);
        if (r) {
            const { subpath } = r;
            if (operationKind === 'select' && subpath === '/records') {
                const start = Date.now();
                const map = await this.storage.list(computeListOpts('rl.r.', parameters));
                const results = [...map].map(v => ({ _key: v[0], value: v[1] }));
                const message = `storage.list took ${Date.now() - start}ms for ${results.length} results`;
                return { results, message };
            }
            if (operationKind === 'delete' && subpath === '/records') {
                const { limit: limitStr } = parameters;
                const limit = tryParseInt(limitStr);
                if (typeof limit !== 'number') throw new Error(`Bad limit: ${JSON.stringify(limitStr)}`);
                const latestStartAfterTimestampId = await this.getOrLoadLatestStartAfterTimestampId();
                if (latestStartAfterTimestampId === undefined) return { message: 'No latestStartAfterTimestampId' };

                const result = await deleteImportedRecords(latestStartAfterTimestampId, limit, this.storage);
                return { results: [ result ] };
            }
            if (operationKind === 'select' && subpath === '/state') {
                const [ latestTimestampId, latestStartAfterTimestampId ] = await Promise.all([ queryLatestTimestampId(this.storage), this.getOrLoadLatestStartAfterTimestampId() ]);
                const state = { latestTimestampId, latestStartAfterTimestampId };
                return { results: [ state ] };
            }
            if (operationKind === 'select' && subpath === '/sfl') {
                const start = Date.now();
                const map = await this.storage.list(computeListOpts('rl.sfl.', parameters));
                const computeRawRedirectKey = (v: RawRedirect) => `${computeTimestamp(v.time)}-${v.uuid}`;
                const results = [...map].map(v => ({ id: v[0].substring('rl.sfl.'.length), redirectKeys: (v[1] as RawRedirect[]).map(computeRawRedirectKey) }));
                const message = `storage.list took ${Date.now() - start}ms for ${results.length} results`;
                return { results, message };
            }
            if ((operationKind === 'update' || operationKind === 'delete') && subpath === '/sfl' && this.queue2) {
                const { ids: idsStr } = parameters;
                const isUpdate = operationKind === 'update';
                if (typeof idsStr !== 'string') throw new Error(`Bad ids: ${JSON.stringify(parameters)}`);
                const timestampIds = distinct(idsStr.split(',').map(v => v.trim()).filter(v => v !== ''));
                for (const timestampId of timestampIds) {
                    const key = computeSaveForLaterKey(timestampId);
                    if (isUpdate) {
                        const rawRedirects = await this.storage.get(key);
                        if (!Array.isArray(rawRedirects)) throw new Error(`Unexpected rawRedirects for ${timestampId}: ${rawRedirects}`);
                        await sendWithRetries(this.queue2, rawRedirects, { tag: 'queue2.resend', contentType: 'json' });
                    }
                    await this.storage.delete(key);
                }
                const results = [ isUpdate ? { resent: timestampIds } : { deleted: timestampIds } ];
                return { results };
            }
            if (operationKind === 'update' && subpath === '/dlq' && this.queue2) {
                const { body } = parameters;
                if (typeof body !== 'string') throw new Error(`Expected 'body' parameter`);
                const rawRedirects = JSON.parse(body);
                if (!(Array.isArray(rawRedirects) && rawRedirects.every(isRawRedirect) && rawRedirects.length > 0)) throw new Error(`Unexpected 'body' parameter`);
                await sendWithRetries(this.queue2, rawRedirects, { tag: 'queue2.resend', contentType: 'json' });
                const results = [ { resent: rawRedirects.length } ];
                return { results };
            }
        }
        throw new Error(`Unsupported rl-related query`);
    }

    //

    private async getOrLoadAttNums(): Promise<AttNums> {
        if (!this.attNums) this.attNums = await loadAttNums(this.storage);
        return this.attNums;
    }

    private async getOrLoadLatestStartAfterTimestampId() {
        if (this.latestStartAfterTimestampId === undefined) {
            const v = await this.storage.get('state.latestStartAfterTimestampId');
            if (typeof v === 'string') this.latestStartAfterTimestampId = v;
        }
        return this.latestStartAfterTimestampId;
    }

}

//

async function queryLatestTimestampId(storage: DurableObjectStorage): Promise<string | undefined> {
    const prefix = 'rl.r.';
    const map = await storage.list({ prefix, reverse: true, limit: 1 });
    const key = [...map.keys()].at(0);
    return key ? key.substring(prefix.length) : undefined;
}

async function scheduleNotification(doName: string, notificationDelaySeconds: number, storage: DurableObjectStorage) {
    const currentAlarm = await storage.getAlarm();
    if (typeof currentAlarm === 'number') return; // pending alarm not started

    console.log(`Scheduling notification ${notificationDelaySeconds} seconds from now`);
    await storage.transaction(async txn => {
        await txn.put('alarm.payload', { kind: RedirectLogController.notificationAlarmKind, doName } as AlarmPayload);
        await txn.setAlarm(Date.now() + 1000 * notificationDelaySeconds);
    });
    writeTraceEvent({ kind: 'storage-write', durableObjectName: doName, spot: 'rlc.scheduleNotification', alarms: 1 });
}

async function loadAttNums(storage: DurableObjectStorage): Promise<AttNums> {
    const record = await storage.get('rl.attNums');
    console.log(`loadAttNums: ${JSON.stringify(record)}`);
    try {
        if (record !== undefined) return AttNums.fromJson(record);
    } catch (e) {
        consoleError('rlc-loading-attnums', `Error loading AttNums from record ${JSON.stringify(record)}: ${(e as Error).stack || e}`);
    }
    return new AttNums();
}

async function deleteImportedRecords(latestStartAfterTimestampId: string, limit: number, storage: DurableObjectStorage): Promise<{ deleted: number, maxInstantToDelete: string, minDeletedInstant?: string, maxDeletedInstant?: string, error?: string, took: number }> {
    const start = Date.now();
    const maxInstantToDelete = addHours(timestampToInstant(unpackTimestampId(latestStartAfterTimestampId).timestamp), -24).toISOString();
    const maxTimestampToDelete = computeTimestamp(maxInstantToDelete);
    const map = await storage.list({ prefix: 'rl.r.', limit, end: 'rl.r.' + maxTimestampToDelete });
    let deleted = 0;
    let minDeletedInstant: string | undefined;
    let maxDeletedInstant: string | undefined;
    let error: string | undefined;
    for (const batch of chunk([...map.keys()], 128)) {
        try {
            await storage.delete(batch);
        } catch (e) {
            error = `${(e as Error).stack || e}`;
            break;
        }
        deleted += batch.length;
        if (minDeletedInstant === undefined) {
            const minKey = batch[0];
            minDeletedInstant = timestampToInstant(unpackTimestampId(minKey.substring('rl.r.'.length)).timestamp);
        }
        const maxKey = batch.at(-1)!;
        maxDeletedInstant = timestampToInstant(unpackTimestampId(maxKey.substring('rl.r.'.length)).timestamp);
    }
    return { deleted, maxInstantToDelete, minDeletedInstant, maxDeletedInstant, error, took: Date.now() - start };
}

function computeSaveForLaterKey(timestampId: string): string {
    unpackTimestampId(timestampId); // validates
    return `rl.sfl.${timestampId}`;
}
