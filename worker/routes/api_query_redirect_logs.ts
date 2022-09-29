import { computeChainDestinationUrl } from '../chain_estimate.ts';
import { check, checkMatches, isNotBlank, isValidHttpUrl, isValidInstant, tryParseInt, tryParseUrl } from '../check.ts';
import { isValidSha1Hex, isValidSha256Hex } from '../crypto.ts';
import { Bytes } from '../deps.ts';
import { tryParseDurationMillis } from '../duration.ts';
import { packError } from '../errors.ts';
import { QueryRedirectLogsRequest, RpcClient, Unkinded } from '../rpc_model.ts';
import { isValidUuid } from '../uuid.ts';
import { QUERY_REDIRECT_LOGS } from './api_contract.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';

export async function computeQueryRedirectLogsResponse(method: string, searchParams: URLSearchParams, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    const { limitDefault, limitMax, limitMin } = QUERY_REDIRECT_LOGS;

    let request: Unkinded<QueryRedirectLogsRequest> = { limit: limitDefault };

    try {
        const { start, startAfter, end, limit, url, urlSha256, userAgent, referer, hashedIpAddress, edgeColo, ulid, format, method, uuid } = Object.fromEntries(searchParams);

        const checkTime = (name: string, value: string) => {
            const duration = tryParseDurationMillis(value);
            if (typeof duration === 'number') {
                value = new Date(Date.now() + duration).toISOString();
            }
            check(name, value, isValidInstant);
            return value;
        }
        if (typeof start === 'string' && typeof startAfter === 'string') throw new Error(`Specify either 'start' or 'startAfter', not both`);
        if (typeof start === 'string') {
            request = { ...request, startTimeInclusive: checkTime('start', start) };
        }
        if (typeof startAfter === 'string') {
            request = { ...request, startTimeExclusive: checkTime('startAfter', startAfter) };
        }
        if (typeof end === 'string') {
            request = { ...request, endTimeExclusive: checkTime('end', end) };
        }
        if (typeof limit === 'string') {
            const lim = tryParseInt(limit);
            if (lim === undefined || lim < limitMin || lim > limitMax) throw new Error(`Bad limit: ${limit}`);
            request = { ...request, limit: lim };
        }
        if (typeof format === 'string') {
            checkMatches('format', format, /^(tsv|json|json-o|json-a)$/);
            request = { ...request, format };
        }
        if ([ url, urlSha256, userAgent, referer, hashedIpAddress, edgeColo, ulid, method, uuid].filter(v => typeof v === 'string').length > 1) throw new Error(`Cannot specify more than one filter parameter`);
        if (typeof url === 'string' && typeof urlSha256 === 'string') throw new Error(`Specify either 'url' or 'urlSha256', not both`);
        if (typeof url === 'string') {
            const m = /^(https?:\/\/.+?)\*$/.exec(url);
            if (m) {
                const [ _, urlStartsWith ] = m;
                const destinationUrl = computeChainDestinationUrl(urlStartsWith) ?? urlStartsWith;
                const u = tryParseUrl(destinationUrl);
                if (!u) throw new Error(`Bad urlStartsWith: ${urlStartsWith}, invalid destination url ${destinationUrl}`);
                if (u.pathname.length <= '/audio/'.length) throw new Error(`Bad urlStartsWith: ${urlStartsWith}, destination url pathname must be at least ${'/audio/'.length + 1} characters long, found ${u.pathname}`);
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
        if (typeof userAgent === 'string') {
            check('userAgent', userAgent, isNotBlank);
            request = { ...request, userAgent };
        }
        if (typeof referer === 'string') {
            check('referer', referer, isNotBlank);
            request = { ...request, referer };
        }
        if (typeof hashedIpAddress === 'string') {
            check('hashedIpAddress', hashedIpAddress, isValidSha1Hex);
            request = { ...request, hashedIpAddress };
        }
        if (typeof edgeColo === 'string') {
            check('edgeColo', edgeColo, isNotBlank);
            request = { ...request, edgeColo };
        }
        if (typeof ulid === 'string') {
            check('ulid', ulid, isNotBlank);
            request = { ...request, ulid };
        }
        if (typeof method === 'string') {
            checkMatches('method', method, /^(HEAD|PUT|PATCH|POST|DELETE|OPTIONS)$/);
            request = { ...request, method };
        }
        if (typeof uuid === 'string') {
            check('uuid', uuid, isValidUuid);
            request = { ...request, uuid };
        }
    } catch (e) {
        const { message } = packError(e);
        return newJsonResponse({ message }, 400);
    }
    return await rpcClient.queryRedirectLogs(request, 'combined-redirect-log');
}
