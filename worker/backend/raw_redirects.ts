import { computeIpAddressForDownload, computeListenerIpAddress } from '../ip_addresses.ts';
import { RawRedirect } from '../rpc_model.ts';
import { computeTimestamp } from '../timestamp.ts';
import { consoleWarn } from '../tracer.ts';
import { AttNums } from './att_nums.ts';
import { tryParseUlid } from '../client_params.ts';
import { generateUuid } from '../uuid.ts';
import { tryParseInt } from '../check.ts';
import { computeRawIpAddress } from '../cloudflare_request.ts';

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
    const { uuid, time, rawIpAddress, method, url, userAgent, referer, range, ulid, xpsId, ipSource, other } = rawRedirect;
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
                consoleWarn(`${callerTag}-pack-raw-redirect`, `Error in computeIpAddressForDownload: ${(e as Error).stack || e}`);
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
    if (typeof ipSource === 'string') rt.ipSource = ipSource;

    for (const [ name, value ] of Object.entries(other ?? {})) {
        if (typeof name === 'string' && typeof value === 'string') {
            rt[`other.${name}`] = value;
        }
    }

    if (typeof doColo === 'string') rt.doColo = doColo;
    
    return attNums.packRecord(rt);
}

export function computeRawRedirect(request: Request, opts: { time: number, method: string, rawIpAddress: string, other?: Record<string, string> }): RawRedirect {
    const { time, method, rawIpAddress, other } = opts;
    const { url } = request;
    const uuid = generateUuid();
    const ulid = tryParseUlid(url);
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const referer = request.headers.get('referer') ?? undefined;
    const range = request.headers.get('range') ?? undefined;
    const xpsId = request.headers.get('x-playback-session-id') ?? undefined;
    const xForwardedFor = computeRawIpAddress(request.headers, 'x-forwarded-for');
    const asnStr = (other ?? {}).asn;
    const asn = typeof asnStr === 'string' ? tryParseInt(asnStr) : undefined;
    const { listenerIpAddress = rawIpAddress, usedXForwardedFor } = computeListenerIpAddress({ rawIpAddress, xForwardedFor, asn, userAgent });
    const ipSource = usedXForwardedFor ? 'x-forwarded-for' : undefined;
    return { uuid, time, rawIpAddress: listenerIpAddress, method, url, userAgent, referer, range, ulid, xpsId, ipSource, other };
}
