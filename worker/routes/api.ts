import { checkDeleteDurableObjectAllowed, tryParseDurableObjectRequest } from './admin_api.ts';
import { ApiTokenPermission, hasPermission, isExternalNotification, RpcClient } from '../rpc_model.ts';
import { newMethodNotAllowedResponse, newJsonResponse, newForbiddenJsonResponse, newTextResponse } from '../responses.ts';
import { computeQueryRedirectLogsResponse } from './api_query_redirect_logs.ts';
import { consoleError } from '../tracer.ts';
import { computeRawIpAddress } from '../cloudflare_request.ts';
import { computeApiKeyResponse, computeApiKeysResponse } from './api_api_keys.ts';
import { computeSessionToken, validateSessionToken } from '../session_token.ts';
import { isValidHttpUrl, isValidInstant } from '../check.ts';
import { StatusError } from '../errors.ts';
import { PodcastIndexClient } from '../podcast_index_client.ts';
import { computeFeedAnalysis } from '../feed_analysis.ts';
import { computeUserAgent, newPodcastIndexClient } from '../outbound.ts';

export function tryParseApiRequest(opts: { instance: string, method: string, hostname: string, origin: string, pathname: string, searchParams: URLSearchParams, headers: Headers, bodyProvider: JsonProvider }): ApiRequest | undefined {
    const { instance, method, hostname, origin, pathname, searchParams, headers, bodyProvider } = opts;
    const m = /^\/api\/1(\/[a-z\/-]+(\/.+?)?)$/.exec(pathname);
    if (!m) return undefined;
    const [ _, path ] = m;
    const m2 = /^bearer (.*?)$/i.exec(headers.get('authorization') ?? '');
    const bearerToken = m2 ? m2[1] : undefined;
    const rawIpAddress = computeRawIpAddress(headers);
    return { instance, method, hostname, origin, path, searchParams, bearerToken, rawIpAddress, bodyProvider };
}

// deno-lint-ignore no-explicit-any
export type JsonProvider = () => Promise<any>;
export type Background = (work: () => Promise<unknown>) => void;

export async function computeApiResponse(request: ApiRequest, opts: { rpcClient: RpcClient, adminTokens: Set<string>, previewTokens: Set<string>, turnstileSecretKey: string | undefined, podcastIndexCredentials: string | undefined, background: Background }): Promise<Response> {
    const { instance, method, hostname, origin, path, searchParams, bearerToken, rawIpAddress, bodyProvider } = request;
    const { rpcClient, adminTokens, previewTokens, turnstileSecretKey, podcastIndexCredentials, background } = opts;

    try {
        // first, we need to know who's calling
        const identity = await computeIdentityResult(bearerToken, searchParams, adminTokens, previewTokens, rpcClient);
        console.log(`computeApiResponse`, { method, path, identity: identityResultToJson(identity) });
    
        // all api endpoints require an auth token
        if (identity.kind === 'invalid' && identity.reason === 'missing-token') return newJsonResponse({ error: 'unauthorized' }, 401);
        if (identity.kind === 'invalid' && identity.reason === 'expired-token') return newJsonResponse({ error: 'expired' }, 401);
        if (identity.kind === 'invalid' && identity.reason === 'blocked-token') return newJsonResponse({ error: 'blocked' }, 401);
    
        // invalid token or any other invalid reason
        if (identity.kind === 'invalid') return newForbiddenJsonResponse();

        const { permissions } = identity;
        if (path === '/admin/metrics') return await computeAdminGetMetricsResponse(permissions, method, rpcClient);
        const isAdmin = permissions.has('admin');
        if (path.startsWith('/admin/')) {
            // all other admin endpoints require admin
            if (!isAdmin) return newForbiddenJsonResponse();

            if (path === '/admin/data') return await computeAdminDataResponse(method, bodyProvider, rpcClient);
            if (path === '/admin/rebuild-index') return await computeAdminRebuildResponse(method, bodyProvider, rpcClient);
        }
        if (path === '/redirect-logs') return await computeQueryRedirectLogsResponse(permissions, method, searchParams, rpcClient);
        if (path === '/api-keys') return await computeApiKeysResponse({ instance, method, hostname, bodyProvider, rawIpAddress, turnstileSecretKey, rpcClient });
        const m = /^\/api-keys\/([0-9a-f]{32})$/.exec(path); if (m) return await computeApiKeyResponse(m[1], isAdmin, { instance, method, hostname, bodyProvider, rawIpAddress, turnstileSecretKey, rpcClient });
        if (path === '/notifications') return await computeNotificationsResponse(permissions, method, bodyProvider, rpcClient); 
        if (path === '/feeds/search') return await computeFeedsSearchResponse(method, origin, bodyProvider, podcastIndexCredentials); 
        if (path === '/feeds/analyze') return await computeFeedsAnalyzeResponse(method, origin, bodyProvider, podcastIndexCredentials, rpcClient, background); 
        if (path === '/session-tokens') return await computeSessionTokensResponse(method, origin, bodyProvider, podcastIndexCredentials); 
    
        // unknown api endpoint
        return newJsonResponse({ error: 'not found' }, 404);
    } catch (e) {
        if (e instanceof StatusError) {
            return newJsonResponse({ error: e.message }, e.status);
        } else {
            const error = `${e.stack || e}`;
            consoleError('api-call', `Error in api call: ${error}`);
            return newJsonResponse({ error }, 500);
        }
    }
}

export interface ApiRequest {
    readonly instance: string;
    readonly method: string;
    readonly hostname: string;
    readonly origin: string;
    readonly path: string;
    readonly searchParams: URLSearchParams;
    readonly bearerToken?: string;
    readonly rawIpAddress?: string;
    readonly bodyProvider: JsonProvider;
}

//

type IdentityResult = ValidIdentityResult | InvalidIdentityResult;

interface ValidIdentityResult {
    readonly kind: 'valid';
    readonly permissions: ReadonlySet<ApiTokenPermission>;
}

interface InvalidIdentityResult {
    readonly kind: 'invalid';
    readonly reason: 'missing-token' | 'invalid-token' | 'blocked-token' | 'expired-token';
}

function identityResultToJson(result: IdentityResult) {
    return result.kind === 'valid' ? { kind: result.kind, permissions: [...result.permissions] } : result;
}

//


async function computeIdentityResult(bearerToken: string | undefined, searchParams: URLSearchParams, adminTokens: Set<string>, previewTokens: Set<string>, rpcClient: RpcClient): Promise<IdentityResult> {
    const token = typeof bearerToken === 'string' ? bearerToken : searchParams.get('token') ?? undefined;
    if (token === undefined) return { kind: 'invalid', reason: 'missing-token' };
    if (adminTokens.has(token)) return { kind: 'valid', permissions: new Set([ 'admin' ]) };
    if (previewTokens.has(token)) return { kind: 'valid', permissions: new Set([ 'preview' ]) };
    const res = await rpcClient.resolveApiToken({ token }, 'api-key-server');
    if (res.permissions !== undefined) return { kind: 'valid', permissions: new Set(res.permissions) };
    if (res.reason === 'blocked') return { kind: 'invalid', reason: 'blocked-token' };
    if (res.reason === 'expired') return { kind: 'invalid', reason: 'expired-token' };
    return { kind: 'invalid', reason: 'invalid-token' };
}

async function computeAdminDataResponse(method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

    const { operationKind, targetPath = '', dryRun, parameters } = await bodyProvider();
    if (operationKind === 'select' && targetPath === '/registry') {
        const { results } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, 'registry');
        return newJsonResponse({ results });
    } else if (operationKind === 'select' && targetPath === '/keys') {
        const { results } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, 'key-server');
        return newJsonResponse({ results });
    } else if (operationKind === 'select' && targetPath.startsWith('/crl/')) {
        const { results } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, 'combined-redirect-log');
        return newJsonResponse({ results });
    } else if (operationKind === 'select' && targetPath === '/crl/records') {
        const { results } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, 'combined-redirect-log');
        return newJsonResponse({ results });
    } else if (operationKind === 'select' && targetPath === '/api-keys') {
        const { results } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, 'api-key-server');
        return newJsonResponse({ results });
    } else if (operationKind === 'select' && targetPath.startsWith('/api-keys/info/')) {
        const { results } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, 'api-key-server');
        return newJsonResponse({ results });
    } else if (operationKind === 'select' && targetPath === '/feed-notifications') {
        const { results } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, 'show-server');
        return newJsonResponse({ results });
    } else if (targetPath.startsWith('/show/')) {
        const { results, message } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, 'show-server');
        return newJsonResponse({ results, message });
    }
    const doName = tryParseDurableObjectRequest(targetPath);
    if (doName) {
        if (operationKind === 'delete') {
            checkDeleteDurableObjectAllowed(doName);
        }
        const { results } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, doName);
        return newJsonResponse({ results });
    }

    throw new StatusError(`Unsupported operationKind ${operationKind} and targetPath ${targetPath}`);
}

async function computeAdminRebuildResponse(method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

    const { indexName, start, inclusive, limit } = await bodyProvider();

    if (typeof indexName !== 'string') throw new StatusError(`Bad indexName: ${indexName}`);
    if (typeof start !== 'string') throw new StatusError(`Bad start: ${start}`);
    if (typeof inclusive !== 'boolean') throw new StatusError(`Bad inclusive: ${inclusive}`);
    if (typeof limit !== 'number') throw new StatusError(`Bad limit: ${limit}`);

    const { first, last, count, millis } = await rpcClient.adminRebuildIndex({ indexName, start, inclusive, limit }, 'combined-redirect-log');
    return newJsonResponse({ first, last, count, millis });
}

async function computeAdminGetMetricsResponse(permissions: ReadonlySet<ApiTokenPermission>, method: string, rpcClient: RpcClient): Promise<Response> {
    if (!hasPermission(permissions, 'admin-metrics')) return newForbiddenJsonResponse();
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    return await rpcClient.adminGetMetrics({}, 'combined-redirect-log');
}

async function computeNotificationsResponse(permissions: ReadonlySet<ApiTokenPermission>, method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (!hasPermission(permissions, 'notification')) return newForbiddenJsonResponse();
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

    const received = new Date().toISOString();
    const notification = await bodyProvider();
    if (!isExternalNotification(notification)) throw new StatusError(`Bad notification body`);

    await rpcClient.receiveExternalNotification({ notification, received }, 'show-server');

    return newTextResponse('thanks');
}

async function sessionTokenCommon(method: string, origin: string, bodyProvider: JsonProvider, podcastIndexCredentials: string | undefined): Promise<{ client: PodcastIndexClient; obj: Record<string, unknown>; claims: Record<string, string> }> {
    if (method !== 'POST') throw new StatusError(`${method} not allowed`, 405);
    if (typeof podcastIndexCredentials !== 'string') throw new StatusError(`forbidden`, 403);
    const client = newPodcastIndexClient({ podcastIndexCredentials, origin });
    if (!client) throw new StatusError(`forbidden`, 403);
    const obj = await bodyProvider();
    const { sessionToken } = obj;
    if (typeof sessionToken !== 'string') throw new StatusError(`forbidden`, 403);
    const claims = await validateSessionToken(sessionToken, podcastIndexCredentials);
    const { k, t } = claims;
    if (typeof k !== 'string') throw new StatusError(`forbidden`, 403);
    if (typeof t !== 'string' || !isValidInstant(t) || (Date.now() - new Date(t).getTime()) > 1000 * 60 * 5) throw new StatusError(`forbidden`, 403);
    return { client, obj, claims };
}

async function feedsCommon(method: string, origin: string, bodyProvider: JsonProvider, podcastIndexCredentials: string | undefined): Promise<{ client: PodcastIndexClient; obj: Record<string, unknown>; }> {
    const { client, obj, claims } = await sessionTokenCommon(method, origin, bodyProvider, podcastIndexCredentials);
    const { k } = claims;
    if (k !== 's') throw new StatusError(`forbidden`, 403);
    return { client, obj };
}

async function computeFeedsSearchResponse(method: string, origin: string, bodyProvider: JsonProvider, podcastIndexCredentials: string | undefined): Promise<Response> {
    const { client, obj } = await feedsCommon(method, origin, bodyProvider, podcastIndexCredentials);
    const { q: qFromObj } = obj;
    const q = typeof qFromObj === 'string' ? qFromObj.trim() : '';
    if (q === '') throw new StatusError(`Bad q: ${qFromObj}`);

    if (/^\d+$/.test(q)) {
        const { feed } = await client.getPodcastByFeedId(parseInt(q));
        const feeds = Array.isArray(feed) ? [] : [ feed ];
        return newJsonResponse({ feeds });
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
        const { feed } = await client.getPodcastByGuid(q);
        const feeds = Array.isArray(feed) ? [] : [ feed ];
        return newJsonResponse({ feeds });
    }

    if (isValidHttpUrl(q)) {
        const { feed } = await client.getPodcastByFeedUrl(q);
        const feeds = Array.isArray(feed) ? [] : [ feed ];
        return newJsonResponse({ feeds });
    }
    
    const res = await client.searchPodcastsByTerm(q);
    const { feeds } = res;
    
    return newJsonResponse({ feeds });
}

async function computeFeedsAnalyzeResponse(method: string, origin: string, bodyProvider: JsonProvider, podcastIndexCredentials: string | undefined, rpcClient: RpcClient, background: Background): Promise<Response> {
    const { obj, client } = await feedsCommon(method, origin, bodyProvider, podcastIndexCredentials);
    const { feed, id } = obj;
    if (typeof feed !== 'string') throw new StatusError(`Bad feed: ${JSON.stringify(feed)}`);
    if (typeof id !== 'number') throw new StatusError(`Bad id: ${JSON.stringify(id)}`);

    const [ getResponseResult, analysisResult ] = await Promise.allSettled([client.getPodcastByFeedId(id), computeFeedAnalysis(feed, { userAgent: computeUserAgent({ origin })})]);
    if (getResponseResult.status === 'rejected') throw new StatusError(`Failed to lookup guid for id ${id}: ${getResponseResult.reason}`);
    if (analysisResult.status === 'rejected') throw new StatusError(`Failed to analyze feed: ${analysisResult.reason.message}`);
    const getResponse = getResponseResult.value;
    const analysis = analysisResult.value;
    if (analysis.itemsWithOp3Enclosures > 0) {
        const time = new Date().toISOString();
        const feedInfo = { received: time, feedUrl: feed, feedPodcastId: id, foundTime: time, source: 'fa', sourceReference: time, items: [] };
        background(() => rpcClient.receiveExternalNotification({ received: time, notification: { sent: time, sender: 'fa', type: 'feeds', feeds: [ feedInfo ] } }, 'show-server'));
    }
    const { feed: gotFeed } = getResponse;
    const guid = !Array.isArray(gotFeed) ? gotFeed.podcastGuid : undefined;
    const rt: Record<string, unknown> = { ...analysis, guid };
    return newJsonResponse(rt);
}

async function computeSessionTokensResponse(method: string, origin: string, bodyProvider: JsonProvider, podcastIndexCredentials: string | undefined): Promise<Response> {
    const { claims } = await sessionTokenCommon(method, origin, bodyProvider, podcastIndexCredentials);
    if (typeof podcastIndexCredentials !== 'string') throw new StatusError(`forbidden`, 403);

    claims.t = new Date().toISOString();

    const sessionToken = await computeSessionToken(claims, podcastIndexCredentials);
    return newJsonResponse({ sessionToken });
}
