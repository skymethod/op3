import { DurableObjectStorage } from './deps.ts';
import { RawRequest } from './raw_request.ts';
import { AttNums } from './att_nums.ts';
import { TimestampSequence } from './timestamp_sequence.ts';
import { computeTimestamp } from './timestamp.ts';

export class RawRequestController {

    private readonly storage: DurableObjectStorage;
    private readonly colo: string;
    private readonly encryptIpAddress: IpAddressEncryptionFn;
    private readonly hashIpAddress: IpAddressHashingFn;

    private readonly timestampSequence = new TimestampSequence(3);
    private attNums: AttNums | undefined;

    constructor(storage: DurableObjectStorage, colo: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn) {
        this.storage = storage;
        this.colo = colo;
        this.encryptIpAddress = encryptIpAddress;
        this.hashIpAddress = hashIpAddress;
    }

    async save(rawRequests: readonly RawRequest[]) {
        if (!this.attNums) this.attNums = await loadAttNums(this.storage);
        const { attNums } = this;
        const attNumsMaxBefore = attNums.max();
        const batches = await computePutBatches(rawRequests, attNums, () => 'rr.r.' + this.timestampSequence.next(), this.encryptIpAddress, this.hashIpAddress);
        if (batches.length > 0) {
            await this.storage.transaction(async txn => {
                for (const batch of batches) {
                    await txn.put(batch);
                }
                if (attNums.max() !== attNumsMaxBefore) {
                    const record = attNums.toJson();
                    console.log(`saveAttNums: ${JSON.stringify(record)}`);
                    await txn.put('rr.attNums', record);
                }
            });
        }
    }

}

//

async function loadAttNums(storage: DurableObjectStorage): Promise<AttNums> {
    const record = await storage.get('rr.attNums');
    console.log(`loadAttNums: ${JSON.stringify(record)}`);
    try {
        if (record !== undefined) return AttNums.fromJson(record);
    } catch (e) {
        console.error(`Error loading AttNums from record ${JSON.stringify(record)}: ${e.stack || e}`);
    }
    return new AttNums();
}

//

export type PutBatch = Record<string, string>; // timestamp-nnnn -> AttRecord
export type IpAddressEncryptionFn = (rawIpAddress: string, opts: { timestamp: string }) => Promise<string>;
export type IpAddressHashingFn = (rawIpAddress: string, opts: { timestamp: string }) => Promise<string>;

export async function computePutBatches(rawRequests: readonly RawRequest[], attNums: AttNums, nextKey: () => string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn): Promise<readonly PutBatch[]> {
    const rt: PutBatch[] = [];
    let batch: PutBatch = {};
    let batchSize = 0;
    for (const rawRequest of rawRequests) {
        const key = nextKey();
        const value = await packRawRequest(rawRequest, attNums, encryptIpAddress, hashIpAddress);
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

export async function packRawRequest(rawRequest: RawRequest, attNums: AttNums, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn): Promise<string> {
    const { uuid, time, rawIpAddress, method, url, userAgent, referer, range, other } = rawRequest;
    const rt: Record<string, string> = {};
    if (typeof uuid === 'string') rt.uuid = uuid;
    if (typeof time !== 'number') throw new Error(`Bad rawRequest ${uuid}: no time!`);
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

    for (const [ name, value ] of Object.entries(other ?? {})) {
        if (typeof name === 'string' && typeof value === 'string') {
            rt[`other.${name}`] = value;
        }
    }
    
    return attNums.packRecord(rt);
}
