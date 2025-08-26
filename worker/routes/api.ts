import { checkDeleteDurableObjectAllowed, tryParseDurableObjectRequest, tryParseRedirectLogRequest } from './admin_api.ts';
import { AdminDataRequest, AdminDataResponse, ApiTokenPermission, hasPermission, isExternalNotification, RpcClient, RpcRequest, Unkinded } from '../rpc_model.ts';
import { newMethodNotAllowedResponse, newJsonResponse, newForbiddenJsonResponse, newTextResponse } from '../responses.ts';
import { computeQueryRedirectLogsResponse } from './api_query_redirect_logs.ts';
import { consoleError } from '../tracer.ts';
import { computeRawIpAddress } from '../cloudflare_request.ts';
import { computeApiKeyResponse, computeApiKeysResponse } from './api_api_keys.ts';
import { computeSessionToken, validateSessionToken } from '../session_token.ts';
import { isStringRecord, isValidHttpUrl, isValidInstant } from '../check.ts';
import { StatusError } from '../errors.ts';
import { PodcastIndexClient } from '../podcast_index_client.ts';
import { computeFeedAnalysis } from '../feed_analysis.ts';
import { computeUserAgent, newPodcastIndexClient } from '../outbound.ts';
import { DoNames } from '../do_names.ts';
import { Queue } from '../deps.ts';
import { tryParseRecomputeShowSummariesForMonthRequest, recomputeShowSummariesForMonth } from '../backend/show_summaries.ts';
import { Blobs } from '../backend/blobs.ts';
import { computeApiQueryDownloadsResponse } from './api_query_downloads.ts';
import { tryParseComputeShowDailyDownloadsRequest, computeShowDailyDownloads } from '../backend/downloads.ts';
import { computeShowsResponse, computeShowStatsResponse, computeShowSummaryStatsResponse, lookupShowUuidForFeedUrl } from './api_shows.ts';
import { Configuration } from '../configuration.ts';
import { computeQueriesResponse } from './api_queries.ts';
import { computeQueryHitsResponse } from './api_query_hits.ts';
import { Baselime } from '../baselime.ts';
import { generateUuid } from '../uuid.ts';
import { Limiter } from '../limiter.ts';
import { tryMakeXfetcher } from '../xfetcher.ts';

export function tryParseApiRequest(opts: { instance: string, method: string, hostname: string, origin: string, pathname: string, searchParams: URLSearchParams, headers: Headers, bodyProvider: JsonProvider, colo: string | undefined, deploySha: string | undefined, deployTime: string | undefined }): ApiRequest | undefined {
    const { instance, method, hostname, origin, pathname, searchParams, headers, bodyProvider, colo, deploySha, deployTime } = opts;
    const m = /^\/api\/1(\/[a-z\/-]+(\/.+?)?)$/.exec(pathname);
    if (!m) return undefined;
    const [ _, path ] = m;
    const m2 = /^bearer (.*?)$/i.exec(headers.get('authorization') ?? '');
    const bearerToken = m2 ? m2[1] : undefined;
    const rawIpAddress = computeRawIpAddress(headers);
    const userAgent = headers.get('user-agent') ?? undefined;
    return { instance, method, hostname, origin, path, searchParams, bearerToken, rawIpAddress, bodyProvider, colo, deploySha, deployTime, userAgent };
}

// deno-lint-ignore no-explicit-any
export type JsonProvider = () => Promise<any>;
export type Background = (work: () => Promise<unknown>) => void;

type Opts = { rpcClient: RpcClient, adminTokens: Set<string>, previewTokens: Set<string>, turnstileSecretKey: string | undefined, podcastIndexCredentials: string | undefined, background: Background, jobQueue: Queue | undefined, statsBlobs: Blobs | undefined, roStatsBlobs: Blobs | undefined, roRpcClient: RpcClient | undefined, configuration: Configuration | undefined, miscBlobs: Blobs | undefined, roMiscBlobs: Blobs | undefined, hitsBlobs: Blobs | undefined, roHitsBlobs: Blobs | undefined, backupBlobs: Blobs | undefined, roBackupBlobs: Blobs | undefined, baselime: Baselime | undefined, limiter: Limiter | undefined, xfetcher: string | undefined };
export async function computeApiResponse(request: ApiRequest, opts: Opts): Promise<Response> {
    const { instance, method, hostname, origin, path, searchParams, bearerToken, rawIpAddress, bodyProvider, colo, deploySha, deployTime, userAgent } = request;
    const { rpcClient, adminTokens, previewTokens, turnstileSecretKey, podcastIndexCredentials, background, jobQueue, statsBlobs, roStatsBlobs, roRpcClient, configuration, miscBlobs, roMiscBlobs, hitsBlobs, roHitsBlobs, backupBlobs, roBackupBlobs, baselime, limiter, xfetcher } = opts;

    const start = Date.now();
    const namespace = `op3-${instance}-api-${method.toLowerCase()}${computeNamespaceSuffix(path)}`;
    const data: Record<string, unknown> = { method, bearerToken, origin, colo, path, searchParams: searchParams.toString(), deploySha, deployTime };
    const response = await (async () => {
        try {
            // handle cors pre-flight
            if (method === 'OPTIONS') return new Response(undefined, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' } });
    
            // first, we need to know who's calling
            const identity = await computeIdentityResult({ bearerToken, searchParams, adminTokens, previewTokens, rpcClient });
            console.log(`computeApiResponse`, { method, path, identity: identityResultToJson(identity) });
            data.identity = `${identity.kind}-${identity.kind === 'invalid' ? identity.reason : [...identity.permissions].join('-') }`;

            // all api endpoints require an auth token
            if (identity.kind === 'invalid' && identity.reason === 'missing-token') return newJsonResponse({ error: 'unauthorized' }, 401);
            if (identity.kind === 'invalid' && identity.reason === 'expired-token') return newJsonResponse({ error: 'expired' }, 401);
            if (identity.kind === 'invalid' && identity.reason === 'blocked-token') return newJsonResponse({ error: 'blocked' }, 401);
        
            // invalid token or any other invalid reason
            if (identity.kind === 'invalid') return newForbiddenJsonResponse();
    
            const { permissions } = identity;
            const hasAdmin = permissions.has('admin');

            if (!hasAdmin && limiter) {
                const { success } = await limiter.isAllowed(`api:ip:${rawIpAddress}`);
                if (!success) return new Response('slow down', { status: 429 });
            }

            if (path === '/admin/metrics') return await computeAdminGetMetricsResponse(permissions, method, rpcClient);
        
            if (path.startsWith('/admin/')) {
                // all other admin endpoints require admin
                if (!hasAdmin) return newForbiddenJsonResponse();
    
                if (path === '/admin/data') return await computeAdminDataResponse(method, bodyProvider, rpcClient, jobQueue, statsBlobs);
                if (path === '/admin/rebuild-index') return await computeAdminRebuildResponse(method, bodyProvider, rpcClient);
                if (path === '/admin/rpc') return await computeAdminRpcResponse(method, bodyProvider, rpcClient);
            }
            if (path === '/redirect-logs') return await computeQueryRedirectLogsResponse(permissions, origin, method, searchParams, rpcClient, rawIpAddress);
            if (path === '/hits') return await computeQueryHitsResponse({ permissions, method, searchParams, rpcClient, roRpcClient, hitsBlobs, roHitsBlobs, backupBlobs, roBackupBlobs, rawIpAddress });
            if (path.startsWith('/downloads/')) return await computeApiQueryDownloadsResponse(permissions, method, path, searchParams, { statsBlobs, roStatsBlobs, colo, rpcClient });
            if (path === '/api-keys') return await computeApiKeysResponse({ instance, isAdmin: hasAdmin, method, hostname, bodyProvider, rawIpAddress, turnstileSecretKey, rpcClient });
            { const m = /^\/api-keys\/([0-9a-f]{32})$/.exec(path); if (m) return await computeApiKeyResponse(m[1], { instance, isAdmin: hasAdmin, method, hostname, bodyProvider, rawIpAddress, turnstileSecretKey, rpcClient }); }
            if (path === '/notifications') return await computeNotificationsResponse(permissions, method, bodyProvider, rpcClient); 
            if (path === '/feeds/search') return await computeFeedsSearchResponse(method, origin, bodyProvider, podcastIndexCredentials); 
            if (path === '/feeds/analyze') return await computeFeedsAnalyzeResponse(method, origin, bodyProvider, podcastIndexCredentials, rpcClient, roRpcClient, searchParams, background, xfetcher); 
            if (path === '/session-tokens') return await computeSessionTokensResponse(method, origin, bodyProvider, podcastIndexCredentials); 
            { const m = /^\/shows\/([0-9a-f]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-zA-Z_-]{15,}=*)$/.exec(path); if (m && configuration) return await computeShowsResponse({ showUuidOrPodcastGuidOrFeedUrlBase64: m[1], method, searchParams, rpcClient, roRpcClient, configuration, origin }); }
            { const m = /^\/shows\/([0-9a-f]{32})\/stats$/.exec(path); if (m && configuration) return await computeShowStatsResponse({ showUuid: m[1], method, searchParams, statsBlobs, roStatsBlobs, configuration }); }
            { const m = /^\/shows\/([0-9a-f]{32})\/summary-stats$/.exec(path); if (m && configuration) return await computeShowSummaryStatsResponse({ showUuid: m[1], method, searchParams, statsBlobs, roStatsBlobs, configuration }); }
            { const m = /^\/queries\/([0-9a-z-]+)$/.exec(path); if (m && configuration) return await computeQueriesResponse({ name: m[1], method, searchParams, miscBlobs, roMiscBlobs, configuration, rpcClient, roRpcClient, statsBlobs, roStatsBlobs }); }
        
            // unknown api endpoint
            return newJsonResponse({ error: 'not found' }, 404);
        } catch (e) {
            if (e instanceof StatusError) {
                return newJsonResponse({ error: e.message }, e.status);
            } else {
                const error = `${(e as Error).stack || e}`;
                consoleError('api-call', `Error in api call: ${error}`);
                return newJsonResponse({ error }, 500);
            }
        }
    })();
    baselime?.sendEvents([ { 
        requestId: generateUuid(), 
        service: `op3-${instance}`, 
        namespace, 
        duration: Math.max(1, Date.now() - start), 
        level: response.status >= 500 ? 'error' : response.status >= 400 ? 'warning' : 'info',
        error: response.status >= 500 ? `status ${response.status}` : undefined,
        data: { 
            ...data, 
            status: response.status, 
            ip: rawIpAddress, 
            contentType: response.headers.get('content-type') ?? undefined,
            userAgent,
        },
    } ]);
    return response;
}

export async function routeAdminDataRequest(request: Unkinded<AdminDataRequest>, rpcClient: RpcClient, statsBlobs: Blobs | undefined): Promise<Unkinded<AdminDataResponse>> {
    const { operationKind, targetPath, parameters, dryRun } = request;
    if (operationKind === 'select' && targetPath === '/registry') {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.registry);
    } else if (operationKind === 'select' && targetPath === '/keys') {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.keyServer);
    } else if (targetPath.startsWith('/crl/')) {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.combinedRedirectLog);
    } else if (operationKind === 'select' && targetPath === '/api-keys') {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.apiKeyServer);
    } else if (operationKind === 'select' && targetPath.startsWith('/api-keys/info/')) {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.apiKeyServer);
    } else if (operationKind === 'select' && targetPath === '/feed-notifications') {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.showServer);
    } else if (targetPath.startsWith('/show/')) {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.showServer);
    } else if (targetPath.startsWith('/hits/')) {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.hitsServer);
    } else if (targetPath.startsWith('/hls/')) {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.hlsServer, { sql: true });
    } 
    
    const csddr = tryParseComputeShowDailyDownloadsRequest({ operationKind, targetPath, parameters });
    if (csddr && parameters) {
        const { backend } = parameters;
        if (backend) {
            const doName = DoNames.storagelessForSuffix(backend);
            return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, doName);
        } else {
            if (statsBlobs === undefined) throw new Error(`computeShowDailyDownloads: statsBlobs is required`);
            const result = await computeShowDailyDownloads(csddr, statsBlobs);
            return { results: [ result ] };
        }
    }

    const rssfmr = tryParseRecomputeShowSummariesForMonthRequest({ operationKind, targetPath, parameters });
    if (rssfmr && parameters) {
        const { backend } = parameters;
        if (backend) {
            const doName = DoNames.storagelessForSuffix(backend);
            return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, doName);
        } else {
            if (statsBlobs === undefined) throw new Error(`recomputeShowSummariesForMonth: statsBlobs is required`);
            const result = await recomputeShowSummariesForMonth(rssfmr, statsBlobs);
            return { results: [ result ] };
        }
    }
    
    const doName = tryParseDurableObjectRequest(targetPath);
    if (doName) {
        if (operationKind === 'delete') {
            checkDeleteDurableObjectAllowed(doName);
        }
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, doName);
    }

    const req = tryParseRedirectLogRequest(targetPath);
    if (req) {
        return await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, parameters, dryRun }, DoNames.redirectLogForColo(req.colo));
    }

    throw new StatusError(`Unsupported operationKind ${operationKind} and targetPath ${targetPath}`);
}

export async function computeIdentityResult({ bearerToken, searchParams, adminTokens, previewTokens, rpcClient }: { bearerToken: string | undefined, searchParams: URLSearchParams, adminTokens: Set<string>, previewTokens: Set<string>, rpcClient: RpcClient }): Promise<IdentityResult> {
    const token = typeof bearerToken === 'string' ? bearerToken : searchParams.get('token') ?? undefined;
    if (token === undefined) return { kind: 'invalid', reason: 'missing-token' };
    if (adminTokens.has(token)) return { kind: 'valid', permissions: new Set([ 'admin' ]), shows: new Set() };
    if (previewTokens.has(token)) return { kind: 'valid', permissions: new Set([ 'preview' ]), shows: new Set() };
    const res = await rpcClient.resolveApiToken({ token }, DoNames.apiKeyServer);
    if (res.permissions !== undefined) return { kind: 'valid', permissions: new Set(res.permissions), shows: new Set(res.shows) };
    if (res.reason === 'blocked') return { kind: 'invalid', reason: 'blocked-token' };
    if (res.reason === 'expired') return { kind: 'invalid', reason: 'expired-token' };
    return { kind: 'invalid', reason: 'invalid-token' };
}

export function computeNamespaceSuffix(path: string): string {
    if (typeof path !== 'string') return '-unknown';
    if (path === '' || path === '/') return '';
    if (!path.startsWith('/')) return '-unknown';
    path = path.substring(1);
    if (path.endsWith('/')) path = path.substring(0, path.length - 1);
    return '-' + path.split('/').map(v => {
        if (v === '') return 'e';
        if (/^[a-z0-9-]{1,20}$/.test(v)) return v;
        return 'x';
    }).join('-');
}

//

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
    readonly colo?: string;
    readonly userAgent?: string;
    readonly deploySha?: string;
    readonly deployTime?: string;
}

export type IdentityResult = ValidIdentityResult | InvalidIdentityResult;

export interface ValidIdentityResult {
    readonly kind: 'valid';
    readonly permissions: ReadonlySet<ApiTokenPermission>;
    readonly shows: ReadonlySet<string>;
}

export interface InvalidIdentityResult {
    readonly kind: 'invalid';
    readonly reason: 'missing-token' | 'invalid-token' | 'blocked-token' | 'expired-token';
}

export function identityResultToJson(result: IdentityResult) {
    return result.kind === 'valid' ? { kind: result.kind, permissions: [...result.permissions], shows: [...result.shows] } : result;
}

//

async function computeAdminDataResponse(method: string, bodyProvider: JsonProvider, rpcClient: RpcClient, jobQueue: Queue | undefined, statsBlobs: Blobs | undefined): Promise<Response> {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

    const { operationKind, targetPath, dryRun, parameters, enqueue } = await bodyProvider();
    if (!(operationKind === 'select' || operationKind === 'update' || operationKind === 'delete')) throw new Error(`Bad operationKind: ${JSON.stringify(operationKind)}`);
    if (!(typeof targetPath === 'string' && targetPath !== '')) throw new Error(`Bad targetPath: ${JSON.stringify(targetPath)}`);
    if (!(dryRun === undefined || typeof dryRun === 'boolean')) throw new Error(`Bad dryRun: ${JSON.stringify(dryRun)}`);
    if (!(parameters === undefined || isStringRecord(parameters) && Object.values(parameters).every(v => typeof v === 'string'))) throw new Error(`Bad parameters: ${JSON.stringify(parameters)}`);
    if (!(enqueue === undefined || typeof enqueue === 'boolean')) throw new Error(`Bad enqueue: ${JSON.stringify(enqueue)}`);
    
    if (enqueue) {
        if (!jobQueue) throw new Error(`Cannot enqueue a job without a jobQueue`);
        const rpcRequest: AdminDataRequest = { kind: 'admin-data', operationKind, targetPath, dryRun, parameters };
        const start = Date.now();
        await jobQueue.send(rpcRequest);
        return newJsonResponse({ message: `Enqueued in ${Date.now() - start}ms` });
    } else {
        try {
            const { results, message } = await routeAdminDataRequest({ operationKind, targetPath, dryRun, parameters }, rpcClient, statsBlobs);
            return newJsonResponse({ results, message });
        } catch (e) {
            if (parameters?.expectStorageTimeout === 'true' && `${(e as Error).stack || e}`.includes('storage operation exceeded timeout')) {
                return newJsonResponse({ message: 'storage operation exceeded timeout' });
            }
            throw e;
        }
    }
}

async function computeAdminRpcResponse(method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

    const { request, target } = await bodyProvider() as { request: RpcRequest, target: string };
    if (request.kind === 'query-packed-redirect-logs') return newJsonResponse(await rpcClient.queryPackedRedirectLogs(request, target));
    if (request.kind === 'query-hits-index') return await rpcClient.queryHitsIndex(request, target);
    if (request.kind === 'execute-sql') return newJsonResponse(await rpcClient.executeSql(request, target));
    
    throw new Error(`Unsupported rpc call: ${JSON.stringify({ request, target })}`);
}

async function computeAdminRebuildResponse(method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

    const { indexName, start, inclusive, limit } = await bodyProvider();

    if (typeof indexName !== 'string') throw new StatusError(`Bad indexName: ${indexName}`);
    if (typeof start !== 'string') throw new StatusError(`Bad start: ${start}`);
    if (typeof inclusive !== 'boolean') throw new StatusError(`Bad inclusive: ${inclusive}`);
    if (typeof limit !== 'number') throw new StatusError(`Bad limit: ${limit}`);

    const { first, last, count, millis } = await rpcClient.adminRebuildIndex({ indexName, start, inclusive, limit }, DoNames.combinedRedirectLog);
    return newJsonResponse({ first, last, count, millis });
}

async function computeAdminGetMetricsResponse(permissions: ReadonlySet<ApiTokenPermission>, method: string, rpcClient: RpcClient): Promise<Response> {
    if (!hasPermission(permissions, 'admin-metrics')) return newForbiddenJsonResponse();
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    return await rpcClient.adminGetMetrics({}, DoNames.hitsServer);
}

async function computeNotificationsResponse(permissions: ReadonlySet<ApiTokenPermission>, method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (!hasPermission(permissions, 'notification')) return newForbiddenJsonResponse();
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

    const received = new Date().toISOString();
    const notification = await bodyProvider();
    if (!isExternalNotification(notification)) throw new StatusError(`Bad notification body`);

    await rpcClient.receiveExternalNotification({ notification, received }, DoNames.showServer);

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

async function computeFeedsAnalyzeResponse(method: string, origin: string, bodyProvider: JsonProvider, podcastIndexCredentials: string | undefined, rpcClient: RpcClient, roRpcClient: RpcClient | undefined, searchParams: URLSearchParams, background: Background, xfetcher: string | undefined): Promise<Response> {
    const { obj, client } = await feedsCommon(method, origin, bodyProvider, podcastIndexCredentials);
    const { feed, id } = obj;
    if (typeof feed !== 'string') throw new StatusError(`Bad feed: ${JSON.stringify(feed)}`);
    if (typeof id !== 'number') throw new StatusError(`Bad id: ${JSON.stringify(id)}`);

    const [ getResponseResult, analysisResult, showUuidResult ] = await Promise.allSettled([ 
        client.getPodcastByFeedId(id),
        computeFeedAnalysis(feed, { userAgent: computeUserAgent({ origin }), xfetcher: tryMakeXfetcher(xfetcher) }),
        lookupShowUuidForFeedUrl(feed, { searchParams, rpcClient, roRpcClient })
    ]);
    if (getResponseResult.status === 'rejected') throw new StatusError(`Failed to lookup guid for id ${id}: ${getResponseResult.reason}`);
    if (analysisResult.status === 'rejected') throw new StatusError(`Failed to analyze feed: ${analysisResult.reason.message}`);
    if (showUuidResult.status === 'rejected') throw new StatusError(`Failed to lookup show: ${showUuidResult.reason.message}`);
    const getResponse = getResponseResult.value;
    const analysis = analysisResult.value;
    const showUuid = showUuidResult.value;
    if (analysis.itemsWithOp3Enclosures > 0) {
        const time = new Date().toISOString();
        const feedInfo = { received: time, feedUrl: feed, feedPodcastId: id, foundTime: time, source: 'fa', sourceReference: time, items: [] };
        background(() => rpcClient.receiveExternalNotification({ received: time, notification: { sent: time, sender: 'fa', type: 'feeds', feeds: [ feedInfo ] } }, DoNames.showServer));
    }
    const { feed: gotFeed } = getResponse;
    const guid = !Array.isArray(gotFeed) ? gotFeed.podcastGuid : undefined;
    const rt: Record<string, unknown> = { ...analysis, guid, showUuid };
    return newJsonResponse(rt);
}

async function computeSessionTokensResponse(method: string, origin: string, bodyProvider: JsonProvider, podcastIndexCredentials: string | undefined): Promise<Response> {
    const { claims } = await sessionTokenCommon(method, origin, bodyProvider, podcastIndexCredentials);
    if (typeof podcastIndexCredentials !== 'string') throw new StatusError(`forbidden`, 403);

    claims.t = new Date().toISOString();

    const sessionToken = await computeSessionToken(claims, podcastIndexCredentials);
    return newJsonResponse({ sessionToken });
}
