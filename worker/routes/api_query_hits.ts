import { AttNums } from '../backend/att_nums.ts';
import { Blobs } from '../backend/blobs.ts';
import { queryPackedRedirectLogsFromHits } from '../backend/hits_common.ts';
import { isValidSha1Hex } from '../crypto.ts';
import { packError } from '../errors.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { newForbiddenJsonResponse, newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { ApiTokenPermission, hasPermission, QueryRedirectLogsRequest, RpcClient, Unkinded } from '../rpc_model.ts';
import { timestampToInstant } from '../timestamp.ts';
import { writeTraceEvent } from '../tracer.ts';
import { check } from '../check.ts';
import { QUERY_HITS } from './api_contract.ts';
import { computeApiQueryCommonParameters, newQueryResponse } from './api_query_common.ts';
import { DoNames } from '../do_names.ts';
import { computeLinestream } from '../streams.ts';

type Opts = { permissions: ReadonlySet<ApiTokenPermission>, method: string, searchParams: URLSearchParams, rpcClient: RpcClient, hitsBlobs: Blobs | undefined, roHitsBlobs: Blobs | undefined, rawIpAddress: string | undefined };
export async function computeQueryHitsResponse({ permissions, method, searchParams, rpcClient, hitsBlobs, roHitsBlobs, rawIpAddress }: Opts): Promise<Response> {
    if (!hasPermission(permissions, 'preview', 'read-data')) return newForbiddenJsonResponse();
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    const targetHitsBlobs = searchParams.has('ro') ? roHitsBlobs : hitsBlobs;
    if (!targetHitsBlobs) throw new Error(`Need hitsBlobs`);

    let request: Unkinded<QueryRedirectLogsRequest>;
    try {
        const admin = permissions.has('admin');
        request = await parseRequest(searchParams, rawIpAddress, admin);
        if (!admin) writeTraceEvent({ kind: 'generic', type: 'qhits', ...computeEventPayload(request, permissions.has('preview')) });
    } catch (e) {
        const { message } = packError(e);
        return newJsonResponse({ message }, 400);
    }
    return await query(request, rpcClient, targetHitsBlobs);
}

//

async function query(request: Unkinded<QueryRedirectLogsRequest>, rpcClient: RpcClient, hitsBlobs: Blobs): Promise<Response> {
    const { format = 'tsv', include = '', hashedIpAddress, rawIpAddress, descending = false } = request;
    const startTime = Date.now();

    let sortKeys: string[] | undefined;
    if (typeof hashedIpAddress === 'string' || typeof rawIpAddress === 'string') {
        const response = await rpcClient.queryHitsIndex({ hashedIpAddress, rawIpAddress }, DoNames.hitsServer);
        if (response.status !== 200) throw new Error(`queryHitsIndex returned ${response.status}`);
        if (!response.body) throw new Error(`queryHitsIndex returned no body`);
        sortKeys = [];
        for await (const line of computeLinestream(response.body)) {
            if (line.length > 0) sortKeys.push(line);
        }
    }

    const attNums = new AttNums();
    const response = await queryPackedRedirectLogsFromHits(request, hitsBlobs, attNums, sortKeys, descending);
    const rows: unknown[] = [];
    const includes = include.split(',');
    const includeAsn = includes.includes('asn');
    const includeHashedIpAddressForDownload = includes.includes('hashedIpAddressForDownload');
    for (const [ _sortKey, record ] of Object.entries(response.records)) {
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
        // if (typeof mostBehindTimestamp === 'string' && timestamp > mostBehindTimestamp) continue;
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

const computeHeaders = (includeAsn: boolean, includeHashedIpAddressForDownload: boolean) => [ 'time', 'uuid', 'hashedIpAddress', 'method', 'url', 'userAgent', 'referer', 'range', 'xpsId', 'ulid', 'edgeColo', 'continent', 'country', 'timezone', 'regionCode', 'region', 'metroCode',
    ...(includeAsn ? [ 'asn' ] : []),
    ...(includeHashedIpAddressForDownload ? [ 'hashedIpAddressForDownload' ] : []),
];

async function parseRequest(searchParams: URLSearchParams, rawIpAddress: string | undefined, admin: boolean): Promise<Unkinded<QueryRedirectLogsRequest>> {
    await Promise.resolve();
    let request: Unkinded<QueryRedirectLogsRequest> = { ...computeApiQueryCommonParameters(searchParams, QUERY_HITS) };
    const { url, urlSha256, userAgent, referer, hashedIpAddress, edgeColo, ulid, xpsId, method, include } = Object.fromEntries(searchParams);

    if ([ url, urlSha256, userAgent, referer, hashedIpAddress, edgeColo, ulid, xpsId, method ].filter(v => typeof v === 'string').length > 1) throw new Error(`Cannot specify more than one filter parameter`);
    if (typeof url === 'string' && typeof urlSha256 === 'string') throw new Error(`Specify either 'url' or 'urlSha256', not both`);
    
    for (const [ name, value ] of Object.entries({ userAgent, referer, ulid, xpsId })) {
        if (typeof value === 'string') throw new Error(`The '${name}' filter is no longer supported`);
    }

    // TODO migrate
    if (typeof url === 'string') {
        throw new Error(`'url' not supported`);
        // const m = /^(https?:\/\/.+?)\*$/.exec(url);
        // if (m) {
        //     const [ _, urlStartsWith ] = m;
        //     const destinationUrl = computeChainDestinationUrl(urlStartsWith) ?? urlStartsWith;
        //     const u = tryParseUrl(destinationUrl);
        //     if (!u) throw new Error(`Bad urlStartsWith: ${urlStartsWith}, invalid destination url ${destinationUrl}`);
        //     if (u.pathname.length <= 1) throw new Error(`Bad urlStartsWith: ${urlStartsWith}, destination url pathname must be at least one character long, found ${u.pathname}`);
        //     request = { ...request, urlStartsWith };
        // } else {
        //     check('url', url, isValidHttpUrl);
        //     const urlSha256 = (await Bytes.ofUtf8(url).sha256()).hex();
        //     request = { ...request, urlSha256 };
        // }
    }
    if (typeof urlSha256 === 'string') {
        throw new Error(`'urlSha256' not supported`);
        // check('urlSha256', urlSha256, isValidSha256Hex);
        // request = { ...request, urlSha256 };
    }
    if (typeof hashedIpAddress === 'string') {
        if (hashedIpAddress === 'current') {
            if (typeof rawIpAddress !== 'string') throw new Error(`Unable to compute current hashedIpAddress`);
            request = { ...request, rawIpAddress };
        } else {
            check('hashedIpAddress', hashedIpAddress, isValidSha1Hex);
            request = { ...request, hashedIpAddress };
        }
    }
    if (typeof include === 'string' && admin) {
        request = { ...request, include };
    }
    return request;
}

function computeEventPayload(request: Unkinded<QueryRedirectLogsRequest>, isPreview: boolean): { strings: string[], doubles: number[] } {
    const { limit = -1, format = '', startTimeInclusive = '', startTimeExclusive = '', endTimeExclusive = '' } = request;
    const { urlSha256, urlStartsWith, userAgent, referer, hashedIpAddress, rawIpAddress, ulid, xpsId } = request;
    const filters = { urlSha256, urlStartsWith, userAgent, referer, hashedIpAddress, rawIpAddress, ulid, xpsId };
    let filterName = '';
    let filterValue = '';
    for (const [ name, value ] of Object.entries(filters)) {
        if (typeof value === 'string') {
            filterName = name;
            filterValue = name === 'rawIpAddress' ? '<elided>' : value;
            break;
        }
    }
    const strings = [
        format,
        startTimeInclusive,
        startTimeExclusive,
        endTimeExclusive,
        filterName,
        filterValue,
    ];
    const doubles = [ 
        limit,
        isPreview ? 0 : 1,
    ];
    return { strings, doubles };
}
