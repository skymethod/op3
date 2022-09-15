import { isStringRecord } from '../check.ts';
import { DurableObjectStorage, DurableObjectStorageValue } from '../deps.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { setAll } from '../maps.ts';
import { QueryRedirectLogsRequest, Unkinded } from '../rpc_model.ts';
import { computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { AttNums } from './att_nums.ts';
import { IndexId, INDEX_DEFINITIONS } from './combined_redirect_log_controller.ts';

export async function queryCombinedRedirectLogs(request: Unkinded<QueryRedirectLogsRequest>, attNums: AttNums, storage: DurableObjectStorage): Promise<Response> {
    const { format = 'tsv' } = request;
    const startTime = Date.now();
    const map = await computeResultMap(request, storage);
    const rows: unknown[] = [];
    for (const record of map.values()) {
        if (typeof record !== 'string') continue;
        const { timestamp, uuid, hashedIpAddress: packedHashedIpAddress, method, url, userAgent, ulid, 'other.colo': edgeColo } = attNums.unpackRecord(record);
        if (typeof timestamp !== 'string') continue;
        if (typeof uuid !== 'string') continue;
        const time = timestampToInstant(timestamp);
        const hashedIpAddress = typeof packedHashedIpAddress === 'string' ? unpackHashedIpAddressHash(packedHashedIpAddress) : undefined;
        if (format === 'tsv' || format === 'json-a') {
            const arr = [ time, uuid, hashedIpAddress, method, url, userAgent, ulid, edgeColo ];
            rows.push(format === 'tsv' ? arr.join('\t') : arr);
        } else {
            rows.push({ time, uuid, hashedIpAddress, method, url, userAgent, ulid, edgeColo });
        }
    }
    const queryTime = Date.now() - startTime;
    if (format === 'tsv') {
        rows.unshift(headers.join('\t'));
        return new Response(rows.join('\n'), { headers: { 'content-type': 'text/tab-separated-values', 'x-query-time': queryTime.toString() } });
    }
    const obj = format === 'json-a' ? { headers, rows, queryTime } : { rows, queryTime };
    return new Response(JSON.stringify(obj, undefined, 2), { headers: { 'content-type': 'application/json' } });
}

//

const headers = [ 'time', 'uuid', 'hashedIpAddress', 'method', 'url', 'userAgent', 'ulid', 'edgeColo' ];

async function computeResultMap(request: Unkinded<QueryRedirectLogsRequest>, storage: DurableObjectStorage): Promise<Map<string, DurableObjectStorageValue>> {
    const { limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, urlSha256, userAgent, referer, range, hashedIpAddress, edgeColo, doColo, source, ulid, method, uuid } = request;
    // parameters validated in edge worker
    
    let prefix = 'crl.r.';
    let index = 'none';
    if (typeof urlSha256 === 'string') {
        prefix = `crl.i0.${IndexId.UrlSha256}.${urlSha256}.`;
        index = IndexId[IndexId.UrlSha256];
    } else {
        for (const [ name, value ] of Object.entries({ userAgent, referer, range, hashedIpAddress, edgeColo, doColo, source, ulid, method, uuid })) {
            if (value === undefined) continue;
            const property = name === 'other.colo' ? 'edgeColo' : name;
            const def = INDEX_DEFINITIONS.find(v => v[0] === property);
            if (def) {
                const [ _, indexId, indexFn ] = def;
                const fn = name === 'hashedIpAddress' ? ((v: string) => v) : indexFn; // provided hashedIpAddress already unpacked!
                const indexValue = await fn(value);
                if (typeof indexValue === 'string') {
                    prefix = `crl.i0.${indexId}.${indexValue}.`;
                    index = IndexId[indexId];
                }
            }
        }
    }

    const start = startTimeInclusive ? `${prefix}${computeTimestamp(startTimeInclusive)}` : undefined;
    const startAfter = startTimeExclusive && !startTimeInclusive ? `${prefix}${computeTimestamp(startTimeExclusive)}-z` : undefined; // z is a value that sorts after any uuid
    const end = endTimeExclusive ? `${prefix}${computeTimestamp(endTimeExclusive)}` : undefined;
    console.log(`queryCombinedRedirectLogs: list storage: ${JSON.stringify({ prefix, index, limit, start, startAfter, end  })}`);
    const map = await storage.list({ prefix, limit, start, startAfter, end });
    if (prefix === 'crl.r.') return map;

    const rt = new Map<string, DurableObjectStorageValue>();
    for (const keyBatch of computeGetBatches(map)) {
        console.log(`queryCombinedRedirectLogs: batch get ${keyBatch.length}`);
        const batch = await storage.get(keyBatch);
        setAll(rt, batch);
    }
    return rt;
}

function computeGetBatches(indexMap: Map<string, DurableObjectStorageValue>): string[][] {
    const rt: string[][] = [];
    let keyBatch: string[] = [];
    let keyBatchSize = 0;
    for (const value of indexMap.values()) {
        if (isStringRecord(value)) {
            const { key } = value;
            if (typeof key === 'string') {
                keyBatch.push(key);
                keyBatchSize++;
                if (keyBatchSize === 128) { // max cf batch size
                    rt.push(keyBatch);
                    keyBatch = [];
                    keyBatchSize = 0;
                }
            }
        }
    }
    if (keyBatchSize > 0) rt.push(keyBatch);
    return rt;
}
