import { AttNums } from '../backend/att_nums.ts';
import { Blobs } from '../backend/blobs.ts';
import { queryPackedRedirectLogsFromHits, computeIndexWindowStartInstant } from '../backend/hits_common.ts';
import { isValidSha1Hex } from '../crypto.ts';
import { packError } from '../errors.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { newForbiddenJsonResponse, newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { ApiTokenPermission, hasPermission, QueryRedirectLogsRequest, RpcClient, Unkinded } from '../rpc_model.ts';
import { timestampToInstant } from '../timestamp.ts';
import { writeTraceEvent } from '../tracer.ts';
import { check, isValidHttpUrl, tryParseUrl } from '../check.ts';
import { QUERY_HITS } from './api_contract.ts';
import { computeApiQueryCommonParameters, newQueryResponse } from './api_query_common.ts';
import { DoNames } from '../do_names.ts';
import { computeLinestream } from '../streams.ts';
import { computeChainDestinationUrl } from '../chain_estimate.ts';

type Opts = { permissions: ReadonlySet<ApiTokenPermission>, method: string, searchParams: URLSearchParams, rpcClient: RpcClient | undefined, roRpcClient: RpcClient | undefined, hitsBlobs: Blobs | undefined, roHitsBlobs: Blobs | undefined, backupBlobs: Blobs | undefined, roBackupBlobs: Blobs | undefined, rawIpAddress: string | undefined };
export async function computeQueryHitsResponse({ permissions, method, searchParams, rpcClient, roRpcClient, hitsBlobs, roHitsBlobs, backupBlobs, roBackupBlobs, rawIpAddress }: Opts): Promise<Response> {
    if (!hasPermission(permissions, 'preview', 'read-data')) return newForbiddenJsonResponse();
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    const targetHitsBlobs = searchParams.has('ro') ? roHitsBlobs : hitsBlobs;
    if (!targetHitsBlobs) throw new Error(`Need hitsBlobs`);

    const targetBackupBlobs = searchParams.has('ro') ? roBackupBlobs : backupBlobs;
    if (!targetBackupBlobs) throw new Error(`Need backupBlobs`);

    const targetRpcClient = searchParams.has('ro') ? roRpcClient : rpcClient;
    if (!targetRpcClient) throw new Error(`Need targetRpcClient`);

    let request: Unkinded<QueryRedirectLogsRequest>;
    try {
        const admin = permissions.has('admin');
        request = await parseRequest(searchParams, rawIpAddress, admin);
        if (!admin) writeTraceEvent({ kind: 'generic', type: 'qhits', ...computeEventPayload(request, permissions.has('preview')) });
    } catch (e) {
        const { message } = packError(e);
        return newJsonResponse({ message }, 400);
    }
    return await query(request, { rpcClient: targetRpcClient, hitsBlobs: targetHitsBlobs, backupBlobs: targetBackupBlobs });
}

//

async function query(request: Unkinded<QueryRedirectLogsRequest>, { rpcClient, hitsBlobs, backupBlobs }: { rpcClient: RpcClient, hitsBlobs: Blobs, backupBlobs: Blobs }): Promise<Response> {
    const { format = 'tsv', include = '', hashedIpAddress, rawIpAddress, url, urlStartsWith, descending = false } = request;
    const startTime = Date.now();

    let indexSortKeys: string[] | undefined;
    if (typeof hashedIpAddress === 'string' || typeof rawIpAddress === 'string' || typeof url === 'string' || typeof urlStartsWith === 'string') {
        const { limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, descending } = request;
        const response = await rpcClient.queryHitsIndex({ limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, hashedIpAddress, rawIpAddress, url, urlStartsWith, descending }, DoNames.hitsServer);
        if (response.status !== 200) throw new Error(`queryHitsIndex returned ${response.status}`);
        if (!response.body) throw new Error(`queryHitsIndex returned no body`);
        indexSortKeys = [];
        for await (const line of computeLinestream(response.body)) {
            if (line.length > 0) indexSortKeys.push(line);
        }
    }

    const attNums = new AttNums();
    const response = await queryPackedRedirectLogsFromHits(request, { hitsBlobs, attNums, indexSortKeys, descending, backupBlobs });
    const rows: unknown[] = [];
    const includes = include.split(',');
    const includeAsn = includes.includes('asn');
    const includeHashedIpAddressForDownload = includes.includes('hashedIpAddressForDownload');
    const includeIpSource = includes.includes('ipSource');
    for (const [ _sortKey, record ] of Object.entries(response.records)) {
        if (typeof record !== 'string') continue;
        const { timestamp, uuid, hashedIpAddress: packedHashedIpAddress, hashedIpAddressForDownload: packedHashedIpAddressForDownload, method, url, userAgent, referer, range, ulid, xpsId, ipSource,
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
        if (typeof uuid !== 'string') continue;
        const time = timestampToInstant(timestamp);
        const hashedIpAddress = typeof packedHashedIpAddress === 'string' ? unpackHashedIpAddressHash(packedHashedIpAddress) : undefined;
        const hashedIpAddressForDownload = typeof packedHashedIpAddressForDownload === 'string' ? unpackHashedIpAddressHash(packedHashedIpAddressForDownload) : undefined;
        if (format === 'tsv' || format === 'json-a') {
            const arr = [ time, uuid, hashedIpAddress, method, url, userAgent, referer, range, xpsId, ulid, edgeColo, continent, country, timezone, regionCode, region, metroCode, 
                ...(includeAsn ? [ asn ] : []),
                ...(includeHashedIpAddressForDownload ? [ hashedIpAddressForDownload ] : []),
                ...(includeIpSource ? [ ipSource ] : []),
            ];
            rows.push(format === 'tsv' ? arr.join('\t') : arr);
        } else {
            rows.push({ time, uuid, hashedIpAddress, method, url, userAgent, referer, range, xpsId, ulid, edgeColo, continent, country, timezone, regionCode, region, metroCode,
                ...(includeAsn ? { asn } : {}),
                ...(includeHashedIpAddressForDownload ? { hashedIpAddressForDownload } : {}),
                ...(includeIpSource ? { ipSource } : {}),
            });
        }
    }
    const headers = computeHeaders(includeAsn, includeHashedIpAddressForDownload, includeIpSource);
    return newQueryResponse({ startTime, format, headers, rows, continuationToken: undefined });
}

const computeHeaders = (includeAsn: boolean, includeHashedIpAddressForDownload: boolean, includeIpSource: boolean) => [ 'time', 'uuid', 'hashedIpAddress', 'method', 'url', 'userAgent', 'referer', 'range', 'xpsId', 'ulid', 'edgeColo', 'continent', 'country', 'timezone', 'regionCode', 'region', 'metroCode',
    ...(includeAsn ? [ 'asn' ] : []),
    ...(includeHashedIpAddressForDownload ? [ 'hashedIpAddressForDownload' ] : []),
    ...(includeIpSource ? [ 'ipSource' ] : []),
];

async function parseRequest(searchParams: URLSearchParams, rawIpAddress: string | undefined, admin: boolean): Promise<Unkinded<QueryRedirectLogsRequest>> {
    await Promise.resolve();
    let request: Unkinded<QueryRedirectLogsRequest> = { ...computeApiQueryCommonParameters(searchParams, QUERY_HITS) };
    const { url, urlSha256, userAgent, referer, hashedIpAddress, edgeColo, ulid, xpsId, method, include } = Object.fromEntries(searchParams);

    if ([ url, urlSha256, userAgent, referer, hashedIpAddress, edgeColo, ulid, xpsId, method ].filter(v => typeof v === 'string').length > 1) throw new Error(`Cannot specify more than one filter parameter`);
    
    for (const [ name, value ] of Object.entries({ userAgent, referer, ulid, xpsId, urlSha256 })) {
        if (typeof value === 'string') throw new Error(`The '${name}' filter is no longer supported`);
    }

    if (typeof url === 'string' || typeof hashedIpAddress === 'string') {
        const { endTimeExclusive } = request;
        const indexWindowStartInstant = computeIndexWindowStartInstant();
        if (endTimeExclusive && endTimeExclusive <= indexWindowStartInstant) throw new Error(`The window for 'url' or 'hashedIpAddress' queries begins on ${indexWindowStartInstant}`);
    }

    if (typeof url === 'string') {
        const m = /^(https?:\/\/.+?)\*$/.exec(url);
        if (m) {
            const [ _, urlStartsWith ] = m;
            const destinationUrl = computeChainDestinationUrl(urlStartsWith) ?? urlStartsWith;
            const u = tryParseUrl(destinationUrl);
            if (!u) throw new Error(`Bad urlStartsWith: ${urlStartsWith}, invalid destination url ${destinationUrl}`);
            if (u.pathname.length <= 1) throw new Error(`Bad urlStartsWith: ${urlStartsWith}, destination url pathname must be at least one character long, found ${u.pathname}`);
            request = { ...request, urlStartsWith };
        } else {
            check('url', url, isValidHttpUrl);
            request = { ...request, url };
        }
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
