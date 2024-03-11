import { isStringRecord } from '../check.ts';
import { DurableObjectStorage, DurableObjectStorageValue, sortBy } from '../deps.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { setAll } from '../maps.ts';
import { newQueryResponse } from '../routes/api_query_common.ts';
import { QueryRedirectLogsRequest, Unkinded } from '../rpc_model.ts';
import { addDays, computeTimestamp, isValidTimestamp, timestampToInstant } from '../timestamp.ts';
import { consoleWarn } from '../tracer.ts';
import { AttNums } from './att_nums.ts';
import { IndexId, INDEX_DEFINITIONS } from './combined_redirect_log_controller.ts';
import { IpAddressHashingFn } from './raw_redirects.ts';

export async function queryCombinedRedirectLogs(request: Unkinded<QueryRedirectLogsRequest>, mostBehindTimestamp: string | undefined, attNums: AttNums, storage: DurableObjectStorage, hashIpAddress: IpAddressHashingFn): Promise<Response> {
    const { format = 'tsv', include = '' } = request;
    const startTime = Date.now();
    const map = await computeResultMap(request, storage, hashIpAddress);
    const rows: unknown[] = [];
    const includes = include.split(',');
    const includeAsn = includes.includes('asn');
    const includeHashedIpAddressForDownload = includes.includes('hashedIpAddressForDownload');
    for (const record of map.values()) {
        if (typeof record !== 'string') continue;
        const { timestamp, uuid, hashedIpAddress: packedHashedIpAddress, hashedIpAddressForDownload: packedHashedIpAddressForDownload, method, url, userAgent, referer, range, ulid, xpsId,
            'other.colo': edgeColo,
            'other.continent': continent,
            'other.country': country,
            'other.timezone': timezone,
            'other.regionCode': regionCode,
            'other.region': region,
            'other.metroCode': metroCode,
            'other.asn': asn,
        } = attNums.unpackRecord(record);
        if (typeof timestamp !== 'string') continue;
        if (typeof mostBehindTimestamp === 'string' && timestamp > mostBehindTimestamp) continue;
        if (typeof uuid !== 'string') continue;
        const time = timestampToInstant(timestamp);
        const hashedIpAddress = typeof packedHashedIpAddress === 'string' ? unpackHashedIpAddressHash(packedHashedIpAddress) : undefined;
        const hashedIpAddressForDownload = typeof packedHashedIpAddressForDownload === 'string' ? unpackHashedIpAddressHash(packedHashedIpAddressForDownload) : undefined;
        if (format === 'tsv' || format === 'json-a') {
            const arr = [ time, uuid, hashedIpAddress, method, url, userAgent, referer, range, xpsId, ulid, edgeColo, continent, country, timezone, regionCode, region, metroCode, 
                ...(includeAsn ? [ asn ] : []),
                ...(includeHashedIpAddressForDownload ? [ hashedIpAddressForDownload ] : []),
            ];
            rows.push(format === 'tsv' ? arr.join('\t') : arr);
        } else {
            rows.push({ time, uuid, hashedIpAddress, method, url, userAgent, referer, range, xpsId, ulid, edgeColo, continent, country, timezone, regionCode, region, metroCode,
                ...(includeAsn ? { asn } : {}),
                ...(includeHashedIpAddressForDownload ? { hashedIpAddressForDownload } : {}),
            });
        }
    }
    const headers = computeHeaders(includeAsn, includeHashedIpAddressForDownload);
    return newQueryResponse({ startTime, format, headers, rows, continuationToken: undefined });
}

//

const computeHeaders = (includeAsn: boolean, includeHashedIpAddressForDownload: boolean) => [ 'time', 'uuid', 'hashedIpAddress', 'method', 'url', 'userAgent', 'referer', 'range', 'xpsId', 'ulid', 'edgeColo', 'continent', 'country', 'timezone', 'regionCode', 'region', 'metroCode',
    ...(includeAsn ? [ 'asn' ] : []),
    ...(includeHashedIpAddressForDownload ? [ 'hashedIpAddressForDownload' ] : []),
];

let _earliestTimestamp: string | undefined;

async function computeEarliestTimestamp(storage: DurableObjectStorage): Promise<string | undefined> {
    if (_earliestTimestamp) return _earliestTimestamp;
    const map = await storage.list({ prefix: 'crl.r.', limit: 1 });
    if (map.size !== 1) return undefined;
    const timestampAndUuid = [...map.keys()][0].substring('crl.r.'.length);
    const rt = tryParseTimestampFromTimestampAndUuid(timestampAndUuid);
    if (!rt) return undefined;
    _earliestTimestamp = rt;
    console.log(`_earliestTimestamp: ${rt}`);
    return rt;
}

function tryParseTimestampFromTimestampAndUuid(timestampAndUuid: string): string | undefined {
    const i = timestampAndUuid.indexOf('-');
    if (i < 0) return undefined;
    const rt = timestampAndUuid.substring(0, i);
    if (!isValidTimestamp(rt)) return undefined;
    return rt;
}

async function computeResultMap(request: Unkinded<QueryRedirectLogsRequest>, storage: DurableObjectStorage, hashIpAddress: IpAddressHashingFn): Promise<Map<string, DurableObjectStorageValue>> {
    const { limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, urlSha256, urlStartsWith, userAgent, referer, rawIpAddress, ulid, xpsId } = request;
    // parameters validated in edge worker

    // compute hashedIpAddress for caller if necessary
    const hashedIpAddress = request.hashedIpAddress ?? (rawIpAddress ? unpackHashedIpAddressHash(await hashIpAddress(rawIpAddress, { timestamp: computeTimestamp() })) : undefined);
    
    // handle urlStartsWith queries separately, uses a more complicated index
    if (typeof urlStartsWith === 'string') {
        const indexValues = await computeUrlStartsWithIndexValues({ urlStartsWith, limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, storage });
        return await lookupRecordsFromIndexValues(indexValues, storage);
    }

    let prefix = 'crl.r.';
    let index = 'none';
    if (typeof urlSha256 === 'string') {
        prefix = `crl.i0.${IndexId.UrlSha256}.${urlSha256}.`;
        index = IndexId[IndexId.UrlSha256];
    } else {
        for (const [ name, value ] of Object.entries({ userAgent, referer, hashedIpAddress, ulid, xpsId })) {
            if (value === undefined) continue;
            const property = name === 'other.colo' ? 'edgeColo' : name;
            const def = INDEX_DEFINITIONS.find(v => v[0] === property);
            if (def) {
                const [ _, indexId, indexFn ] = def;
                const fn = name === 'hashedIpAddress' ? ((v: string) => v) : indexFn; // provided hashedIpAddress already unpacked!
                const indexValue = await fn(value, '220101');
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

    return await lookupRecordsFromIndexValues(map, storage);
}

async function computeUrlStartsWithIndexValues({ urlStartsWith, limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, storage }: 
    { urlStartsWith: string, limit: number, startTimeInclusive: string | undefined, startTimeExclusive: string | undefined, endTimeExclusive: string | undefined, storage: DurableObjectStorage }): Promise<Map<string, DurableObjectStorageValue>> {
    // DayUrl
    // `crl.i0.${indexId}.${indexValue}.${timestampAndUuid}`
    // indexValue: ${timestamp}.${url}

    const rt = new Map<string, DurableObjectStorageValue>();

    // first, find the start day
    const startTimestamp = startTimeInclusive ? computeTimestamp(startTimeInclusive) : undefined;
    const startAfterTimestamp = startTimeExclusive ? computeTimestamp(startTimeExclusive) : undefined;
    const endTimestamp = endTimeExclusive ? computeTimestamp(endTimeExclusive) : undefined;
    const rangeStartTimestamp = (startTimestamp ?? startAfterTimestamp ?? await computeEarliestTimestamp(storage));
    if (!rangeStartTimestamp) {
        consoleWarn('crlq-no-data', `computeUrlStartsWithIndexValues: no rangeStartTimestamp, assume no data`);
        return rt; // we must have no data at all
    }
    const rangeStartInstant = timestampToInstant(rangeStartTimestamp);
    const index = IndexId.DayUrl;
    const def = INDEX_DEFINITIONS.find(v => v[1] === index)!;
    for (let i = 0; i < 10; i++) { // max 10 day scans
        const date = addDays(new Date(rangeStartInstant), i);
        if (computeTimestamp(date).substring(0, 6) > computeTimestamp().substring(0, 6)) return rt; // don't bother to scan in future days

        const timestamp = computeTimestamp(date);
        console.log(`computeUrlStartsWithIndexValues: urlStartsWith, rangeStartInstant=${rangeStartInstant}, timestamp=${timestamp}`);
    
        // scan the index for the day
        const indexValue = await def[2](urlStartsWith, timestamp);
        if (!indexValue) {
            consoleWarn('crlq-no-index-value', `computeUrlStartsWithIndexValues: no indexValue, urlStartsWith=${urlStartsWith}, timestamp=${timestamp}`);
            return rt;
        }
        const prefix = `crl.i0.${index}.${indexValue}`;
        const start = `crl.i0.${index}.${indexValue.substring(0, 6)}`;
        const end = `crl.i0.${index}.${computeTimestamp(addDays(date, 1)).substring(0, 6)}`;
        console.log(`computeUrlStartsWithIndexValues: list storage: ${JSON.stringify({ prefix, index, start, end })}`);
        const results = await storage.list({ prefix, start, end }); // no limit, index sorts by url first, then timestamp - we need to do a full scan of the day
        const filteredResults = new Map<string, [string, DurableObjectStorageValue]>();
        for (const [ key, value ] of results) {
            const timestampAndUuid = key.split('.').at(-1)!;
            const keyTimestamp = tryParseTimestampFromTimestampAndUuid(timestampAndUuid);
            if (!keyTimestamp) continue;
            if (startTimestamp && keyTimestamp < startTimestamp) continue;
            if (startAfterTimestamp && keyTimestamp <= startAfterTimestamp) continue;
            if (endTimestamp && keyTimestamp >= endTimestamp) continue;
            filteredResults.set(key, [keyTimestamp, value]);
        }
        // TODO there may be more if the limit is high enough
        for (const [ key, [ _keyTimestamp, value ] ] of sortBy([...filteredResults], v => v[1][0])) { // order by timestamp asc
            if (rt.size >= limit) return rt;
            rt.set(key, value);
        }
    }
    return rt;
}

async function lookupRecordsFromIndexValues(indexValues: Map<string, DurableObjectStorageValue>, storage: DurableObjectStorage) {
    const rt = new Map<string, DurableObjectStorageValue>();
    for (const keyBatch of computeGetBatches(indexValues)) {
        console.log(`lookupRecordsFromIndexValues: batch get ${keyBatch.length}`);
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
