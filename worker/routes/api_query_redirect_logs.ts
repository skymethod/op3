import { computeChainDestinationUrl } from '../chain_estimate.ts';
import { check, isNotBlank, isValidHttpUrl, tryParseUrl } from '../check.ts';
import { isValidSha1Hex, isValidSha256Hex } from '../crypto.ts';
import { Bytes } from '../deps.ts';
import { DoNames } from '../do_names.ts';
import { packError } from '../errors.ts';
import { newForbiddenJsonResponse, newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { ApiTokenPermission, hasPermission, QueryRedirectLogsRequest, RpcClient, Unkinded } from '../rpc_model.ts';
import { writeTraceEvent } from '../tracer.ts';
import { QUERY_REDIRECT_LOGS } from './api_contract.ts';
import { computeApiQueryCommonParameters } from './api_query_common.ts';

export async function computeQueryRedirectLogsResponse(permissions: ReadonlySet<ApiTokenPermission>, origin: string, method: string, searchParams: URLSearchParams, rpcClient: RpcClient, rawIpAddress: string | undefined): Promise<Response> {
    const u = new URL(`${origin}/api/1/hits`);
    for (const [ name, value ] of searchParams) {
        u.searchParams.append(name, value);
    }
    const location = u.toString();
    return new Response('', { status: 308, headers: { location } });
    
    // OBSOLETE as of 2024-04-17
    // if (!hasPermission(permissions, 'preview', 'read-data')) return newForbiddenJsonResponse();
    // if (method !== 'GET') return newMethodNotAllowedResponse(method);

    // let request: Unkinded<QueryRedirectLogsRequest>;
    // try {
    //     const admin = permissions.has('admin');
    //     request = await parseRequest(searchParams, rawIpAddress, admin);
    //     if (!admin) writeTraceEvent({ kind: 'generic', type: 'qrl', ...computeEventPayload(request, permissions.has('preview')) });
    // } catch (e) {
    //     const { message } = packError(e);
    //     return newJsonResponse({ message }, 400);
    // }
    // return await rpcClient.queryRedirectLogs(request, DoNames.combinedRedirectLog);
}

//

async function parseRequest(searchParams: URLSearchParams, rawIpAddress: string | undefined, admin: boolean): Promise<Unkinded<QueryRedirectLogsRequest>> {
    let request: Unkinded<QueryRedirectLogsRequest> = { ...computeApiQueryCommonParameters(searchParams, QUERY_REDIRECT_LOGS) };
    const { url, urlSha256, referer, hashedIpAddress, edgeColo, ulid, xpsId, method, include } = Object.fromEntries(searchParams);

    if ([ url, urlSha256, referer, hashedIpAddress, edgeColo, ulid, xpsId, method ].filter(v => typeof v === 'string').length > 1) throw new Error(`Cannot specify more than one filter parameter`);
    if (typeof url === 'string' && typeof urlSha256 === 'string') throw new Error(`Specify either 'url' or 'urlSha256', not both`);
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
            const urlSha256 = (await Bytes.ofUtf8(url).sha256()).hex();
            request = { ...request, urlSha256 };
        }
    }
    if (typeof urlSha256 === 'string') {
        check('urlSha256', urlSha256, isValidSha256Hex);
        request = { ...request, urlSha256 };
    }
    if (typeof referer === 'string') {
        check('referer', referer, isNotBlank);
        request = { ...request, referer };
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
    if (typeof ulid === 'string') {
        check('ulid', ulid, isNotBlank);
        request = { ...request, ulid };
    }
    if (typeof xpsId === 'string') {
        check('xpsId', xpsId, isNotBlank);
        request = { ...request, xpsId };
    }
    if (typeof include === 'string' && admin) {
        request = { ...request, include };
    }
    return request;
}

function computeEventPayload(request: Unkinded<QueryRedirectLogsRequest>, isPreview: boolean): { strings: string[], doubles: number[] } {
    const { limit = -1, format = '', startTimeInclusive = '', startTimeExclusive = '', endTimeExclusive = '' } = request;
    const { urlSha256, urlStartsWith, referer, hashedIpAddress, rawIpAddress, ulid, xpsId } = request;
    const filters = { urlSha256, urlStartsWith, referer, hashedIpAddress, rawIpAddress, ulid, xpsId };
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
