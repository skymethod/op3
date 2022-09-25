import { DurableObjectStorage } from '../deps.ts';
import { AttNums } from './att_nums.ts';
import { TimestampSequence } from './timestamp_sequence.ts';
import { computeTimestamp } from '../timestamp.ts';
import { AlarmPayload, PackedRedirectLogs, RpcClient, RawRedirect } from '../rpc_model.ts';
import { check } from '../check.ts';
import { consoleError } from '../tracer.ts';

export class RedirectLogController {
    static readonly notificationAlarmKind = 'RedirectLogController.notificationAlarmKind';

    private readonly storage: DurableObjectStorage;
    private readonly colo: string;
    private readonly doName: string;
    private readonly encryptIpAddress: IpAddressEncryptionFn;
    private readonly hashIpAddress: IpAddressHashingFn;
    private readonly notificationDelaySeconds: number;

    private readonly timestampSequence = new TimestampSequence(3);
    private attNums: AttNums | undefined;

    constructor(opts: { storage: DurableObjectStorage, colo: string, doName: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn, notificationDelaySeconds?: number }) {
        const { storage, colo, doName, encryptIpAddress, hashIpAddress, notificationDelaySeconds = 5 } = opts;
        check('notificationDelaySeconds', notificationDelaySeconds, v => v >= 0);

        this.storage = storage;
        this.colo = colo;
        this.doName = doName;
        this.encryptIpAddress = encryptIpAddress;
        this.hashIpAddress = hashIpAddress;
        this.notificationDelaySeconds = notificationDelaySeconds;
    }

    async save(rawRedirects: readonly RawRedirect[]) {
        const attNums = await this.getOrLoadAttNums();
        const attNumsMaxBefore = attNums.max();
        const batches = await computePutBatches(rawRedirects, attNums, this.colo, () => `rl.r.${this.timestampSequence.next()}`, this.encryptIpAddress, this.hashIpAddress);
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
        return { namesToNums, records };
    }

    static async sendNotification(input: Record<string, unknown>, opts: { fromColo: string, storage: DurableObjectStorage, rpcClient: RpcClient }) {
        console.log(`RedirectLogController.sendNotifcation: ${JSON.stringify(input)}`);
        const { storage, rpcClient, fromColo } = opts;
        const { doName } = input;
        if (typeof doName === 'string') {
            const timestampId = await queryLatestTimestampId(storage);
            if (timestampId) {
                await rpcClient.sendRedirectLogsNotification({ doName, timestampId, fromColo }, 'combined-redirect-log');
            }
        }
    }

    //

    private async getOrLoadAttNums(): Promise<AttNums> {
        if (!this.attNums) this.attNums = await loadAttNums(this.storage);
        return this.attNums;
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
}

async function loadAttNums(storage: DurableObjectStorage): Promise<AttNums> {
    const record = await storage.get('rl.attNums');
    console.log(`loadAttNums: ${JSON.stringify(record)}`);
    try {
        if (record !== undefined) return AttNums.fromJson(record);
    } catch (e) {
        consoleError('rlc-loading-attnums', `Error loading AttNums from record ${JSON.stringify(record)}: ${e.stack || e}`);
    }
    return new AttNums();
}

//

export type PutBatch = Record<string, string>; // timestamp-nnnn -> AttRecord
export type IpAddressEncryptionFn = (rawIpAddress: string, opts: { timestamp: string }) => Promise<string>;
export type IpAddressHashingFn = (rawIpAddress: string, opts: { timestamp: string }) => Promise<string>;

export async function computePutBatches(rawRedirects: readonly RawRedirect[], attNums: AttNums, doColo: string, nextKey: () => string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn): Promise<readonly PutBatch[]> {
    const rt: PutBatch[] = [];
    let batch: PutBatch = {};
    let batchSize = 0;
    for (const rawRedirect of rawRedirects) {
        const key = nextKey();
        const value = await packRawRedirect(rawRedirect, attNums, doColo, encryptIpAddress, hashIpAddress);
        console.log(`batch item: ${key} -> ${value}`);
        batch[key] = value;
        batchSize++;
        if (batchSize === 128) { // max cf batch size
            rt.push(batch);
            batch = {};
            batchSize = 0;
        }
    }
    if (batchSize > 0) rt.push(batch);
    return rt;
}

export async function packRawRedirect(rawRedirect: RawRedirect, attNums: AttNums, doColo: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn): Promise<string> {
    const { uuid, time, rawIpAddress, method, url, userAgent, referer, range, ulid, other } = rawRedirect;
    const rt: Record<string, string> = {};
    if (typeof uuid === 'string') rt.uuid = uuid;
    if (typeof time !== 'number') throw new Error(`Bad rawRedirect ${uuid}: no time!`);
    const timestamp = computeTimestamp(time);
    rt.timestamp = timestamp;
    if (typeof rawIpAddress === 'string') {
        rt.encryptedIpAddress = await encryptIpAddress(rawIpAddress, { timestamp });
        rt.hashedIpAddress = await hashIpAddress(rawIpAddress, { timestamp });
    }
    if (typeof method === 'string') rt.method = method;
    if (typeof url === 'string') rt.url = url;
    if (typeof userAgent === 'string') rt.userAgent = userAgent;
    if (typeof referer === 'string') rt.referer = referer;
    if (typeof range === 'string') rt.range = range;
    if (typeof ulid === 'string') rt.ulid = ulid;

    for (const [ name, value ] of Object.entries(other ?? {})) {
        if (typeof name === 'string' && typeof value === 'string') {
            rt[`other.${name}`] = value;
        }
    }

    if (typeof doColo === 'string') rt.doColo = doColo;
    
    return attNums.packRecord(rt);
}
