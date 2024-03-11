import { computeIpAddressForDownload } from '../ip_addresses.ts';
import { RawRedirect } from '../rpc_model.ts';
import { computeTimestamp } from '../timestamp.ts';
import { consoleWarn } from '../tracer.ts';
import { AttNums } from './att_nums.ts';

export type PutBatch = Record<string, string>; // timestamp-nnnn -> AttRecord
export type IpAddressEncryptionFn = (rawIpAddress: string, opts: { timestamp: string }) => Promise<string>;
export type IpAddressHashingFn = (rawIpAddress: string, opts: { timestamp: string }) => Promise<string>;

export async function computePutBatches(rawRedirects: readonly RawRedirect[], attNums: AttNums, doColo: string, callerTag: string, nextKey: () => string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn): Promise<readonly PutBatch[]> {
    const rt: PutBatch[] = [];
    let batch: PutBatch = {};
    let batchSize = 0;
    for (const rawRedirect of rawRedirects) {
        const key = nextKey();
        const value = await packRawRedirect(rawRedirect, attNums, doColo, callerTag, encryptIpAddress, hashIpAddress);
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

export async function packRawRedirect(rawRedirect: RawRedirect, attNums: AttNums, doColo: string, callerTag: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn): Promise<string> {
    const { uuid, time, rawIpAddress, method, url, userAgent, referer, range, ulid, xpsId, other } = rawRedirect;
    const rt: Record<string, string> = {};
    if (typeof uuid === 'string') rt.uuid = uuid;
    if (typeof time !== 'number') throw new Error(`Bad rawRedirect ${uuid}: no time!`);
    const timestamp = computeTimestamp(time);
    rt.timestamp = timestamp;
    if (typeof rawIpAddress === 'string') {
        rt.encryptedIpAddress = await encryptIpAddress(rawIpAddress, { timestamp });
        rt.hashedIpAddress = await hashIpAddress(rawIpAddress, { timestamp });
        const ipAddressForDownload = (() => {
            try {
                return computeIpAddressForDownload(rawIpAddress);
            } catch (e) {
                consoleWarn(`${callerTag}-pack-raw-redirect`, `Error in computeIpAddressForDownload: ${e.stack || e}`);
                return rawIpAddress;
            }
        })(); 
        rt.hashedIpAddressForDownload = await hashIpAddress(ipAddressForDownload, { timestamp });
    }
    if (typeof method === 'string') rt.method = method;
    if (typeof url === 'string') rt.url = url;
    if (typeof userAgent === 'string') rt.userAgent = userAgent;
    if (typeof referer === 'string') rt.referer = referer;
    if (typeof range === 'string') rt.range = range;
    if (typeof ulid === 'string') rt.ulid = ulid;
    if (typeof xpsId === 'string') rt.xpsId = xpsId;

    for (const [ name, value ] of Object.entries(other ?? {})) {
        if (typeof name === 'string' && typeof value === 'string') {
            rt[`other.${name}`] = value;
        }
    }

    if (typeof doColo === 'string') rt.doColo = doColo;
    
    return attNums.packRecord(rt);
}
