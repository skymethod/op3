import { computeColo, computeOther, computeRawIpAddress } from './cloudflare_request.ts';
import { ModuleWorkerContext, QueueMessageBatch } from './deps.ts';
import { computeHomeResponse } from './routes/home.ts';
import { computeInfoResponse } from './routes/info.ts';
import { computeRedirectResponse, tryParseRedirectRequest } from './routes/redirect_episode.ts';
import { WorkerEnv } from './worker_env.ts';
import { IsolateId } from './isolate_id.ts';
import { Background, computeApiResponse, routeAdminDataRequest, tryParseApiRequest } from './routes/api.ts';
import { CloudflareRpcClient } from './cloudflare_rpc_client.ts';
import { generateUuid } from './uuid.ts';
import { tryParseUlid } from './client_params.ts';
import { isRpcRequest, RawRedirect } from './rpc_model.ts';
import { computeApiDocsResponse } from './routes/api_docs.ts';
import { computeApiDocsSwaggerResponse } from './routes/api_docs_swagger.ts';
import { computeTermsResponse } from './routes/terms.ts';
import { computePrivacyResponse } from './routes/privacy.ts';
import { computeReleasesResponse, tryParseReleasesRequest } from './routes/releases.ts';
import { compute404Response } from './routes/404.ts';
import { newMethodNotAllowedResponse } from './responses.ts';
import { computeRobotsTxtResponse, computeSitemapXmlResponse } from './routes/robots.ts';
import { consoleError, consoleWarn, writeTraceEvent } from './tracer.ts';
import { computeChainDestinationHostname } from './chain_estimate.ts';
import { initCloudflareTracer } from './cloudflare_tracer.ts';
import { computeCostsResponse } from './routes/costs.ts';
import { computeApiKeysResponse } from './routes/api_keys.ts';
import { computeSetupResponse } from './routes/setup.ts';
import { DoNames } from './do_names.ts';
import { Banlist } from './banlist.ts';
import { ManualColo } from './backend/manual_colo.ts';
import { R2BucketBlobs } from './backend/r2_bucket_blobs.ts';
import { ReadonlyRemoteDataRpcClient } from './rpc_clients.ts';
import { computeShowResponse, tryParseShowRequest } from './routes/show.ts';
import { CloudflareConfiguration } from './cloudflare_configuration.ts';
import { computeDownloadCalculationResponse } from './routes/download_calculation.ts';
import { computeStatsResponse } from './routes/stats.ts';
export { BackendDO } from './backend/backend_do.ts';

export default {
    
    async fetch(request: Request, env: WorkerEnv, context: ModuleWorkerContext): Promise<Response> {
        try {
            const requestTime = Date.now();

            initCloudflareTracer(env.dataset1);
            if (!banlist) banlist = new Banlist(env.kvNamespace);
        
            // first, handle redirects - the most important function
            // be careful here: must never throw
            const redirectResponse = await tryComputeRedirectResponse(request, { env, context, requestTime });
            if (redirectResponse) return redirectResponse;

            // handle all other requests
            let response: Response;
            try {
                response = await computeResponse(request, env, context);
            } catch (e) {
                consoleError('worker-compute-response', `Unhandled error computing response: ${e.stack || e}`);
                response = new Response('failed', { status: 500 });
            }
            
            // request/response metrics
            writeTraceEvent(() => {
                const millis = Date.now() - requestTime;
                const { colo = 'XXX', country = 'XX' } = computeOther(request) ?? {};
                const { method } = request;
                const { status } = response;
                const { pathname } = new URL(request.url);
                const contentType = response.headers.get('content-type') ?? '<unspecified>';
                return { kind: 'worker-request', colo, pathname, country, method, contentType, millis, status };
            });

            return response;
        } catch (e) {
            consoleError('worker-unhandled', `Unhandled error in worker fetch: ${e.stack || e}`);
            return new Response('failed', { status: 500 });
        }
    },

    async queue(batch: QueueMessageBatch, env: WorkerEnv) {
        try {
            const { dataset1, backendNamespace, blobsBucket } = env;
            initCloudflareTracer(dataset1);
            const colo = await ManualColo.get();
            const rpcClient = new CloudflareRpcClient(backendNamespace, 3);
            const statsBlobs = blobsBucket ? new R2BucketBlobs({ bucket: blobsBucket, prefix: 'stats/' }) : undefined;

            for (const { body, id, timestamp } of batch.messages) {
                if (isRpcRequest(body)) {
                    const { kind } = body;
                    if (kind === 'admin-data') {
                        const { operationKind, targetPath, parameters, dryRun } = body;
                        const start = Date.now();

                        const response = await routeAdminDataRequest(body, rpcClient, statsBlobs);
                        console.log(JSON.stringify(response, undefined, 2));
                        const millis = Date.now() - start;
                        const { results, message } = response;
                        writeTraceEvent({
                            kind: 'admin-data-job',
                            colo,
                            messageId: id,
                            messageInstant: timestamp.toISOString(),
                            operationKind,
                            targetPath,
                            parameters,
                            dryRun,
                            millis,
                            results,
                            message,
                        });
                    } else {
                        consoleWarn('queue-handler', `Cannot process '${kind}' rpcs in the queue handler`);
                    }
                } else {
                    consoleWarn('queue-handler', `Unsupported message body: ${JSON.stringify(body)}`);
                }
            }
        } catch (e) {
            consoleError('queue-unhandled', `Unhandled error in worker ${batch.queue} queue handler: ${e.stack || e}`);
            throw e; // Queues will retry for us
        }
    },
    
}

//

const pendingRawRedirects: RawRedirect[] = [];
let banlist: Banlist | undefined;

async function tryComputeRedirectResponse(request: Request, opts: { env: WorkerEnv, context: ModuleWorkerContext, requestTime: number }): Promise<Response | undefined> {
    // must never throw!
    const redirectRequest = tryParseRedirectRequest(request.url);
    if (!redirectRequest) return undefined;

    const { env, context, requestTime } = opts;
    const rawRedirects = pendingRawRedirects.splice(0);

    // ban check is the only awaited thing, it needs to be in the direct line of the response
    // a trivial in-memory lookup for a running worker, falls back to colo cache api (fast) or kv (fast-ish) in the worst case
    const banned = redirectRequest.kind === 'valid' && await banlist?.isBanned(redirectRequest.targetUrl);

    // do the expensive work after quickly returning the redirect response
    context.waitUntil((async () => {
        const { backendNamespace } = env;
        const { method } = request;
        let colo = 'XXX';
        try {
            IsolateId.log();
            if (!backendNamespace) throw new Error(`backendNamespace not defined!`);
            
            if (redirectRequest.kind === 'valid' && !banned) {
                const rawIpAddress = computeRawIpAddress(request.headers) ?? '<missing>';
                const other = computeOther(request) ?? {};
                colo = (other ?? {}).colo ?? colo;
                other.isolateId = IsolateId.get();
                const rawRedirect = computeRawRedirect(request, { time: requestTime, method, rawIpAddress, other });
                console.log(`rawRedirect: ${JSON.stringify({ ...rawRedirect, rawIpAddress: '<hidden>' }, undefined, 2)}`);
                rawRedirects.push(rawRedirect);
            }
            
            if (rawRedirects.length > 0) {
                const doName = DoNames.redirectLogForColo(colo);
                const rpcClient = new CloudflareRpcClient(backendNamespace, 5);
                await rpcClient.logRawRedirects({ rawRedirects }, doName);
            }
        } catch (e) {
            consoleError('worker-sending-redirects', `Error sending raw redirects: ${e.stack || e}`);
            // we'll retry if this isolate gets hit again, otherwise lost
            pendingRawRedirects.push(...rawRedirects);
            writeTraceEvent(() => {
                const { colo = 'XXX', country = 'XX' } = computeOther(request) ?? {};
                return { kind: 'error-saving-redirect', colo, error: `${e.stack || e}`, country, uuids: rawRedirects.map(v => v.uuid) };
            });
        } finally {
            writeTraceEvent(() => {
                const { colo = 'XXX', country = 'XX' } = computeOther(request) ?? {};
                const { url, headers } = request;
                const destinationHostname = computeChainDestinationHostname(url) ?? '<unknown>';
                const userAgent = headers.get('user-agent') ?? '<missing>';
                const referer = headers.get('referer') ?? '<missing>';
                return { kind: banned ? 'banned-redirect' : redirectRequest.kind === 'valid' ? 'valid-redirect' : 'invalid-redirect', colo, url, country, destinationHostname, userAgent, referer };
            });
        }
    })());
    if (banned) {
        console.log(`Non-podcast redirect url: ${request.url}`);
        return new Response('Non-podcast redirect url', { status: 400 });
    } else if (redirectRequest.kind === 'valid') {
        console.log(`Redirecting to: ${redirectRequest.targetUrl}`);
        return computeRedirectResponse(redirectRequest);
    } else {
        console.log(`Invalid redirect url: ${request.url}`);
        return new Response('Invalid redirect url', { status: 400 });
    }
}

function computeRawRedirect(request: Request, opts: { time: number, method: string, rawIpAddress: string, other?: Record<string, string> }): RawRedirect {
    const { time, method, rawIpAddress, other } = opts;
    const { url } = request;
    const uuid = generateUuid();
    const ulid = tryParseUlid(url);
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const referer = request.headers.get('referer') ?? undefined;
    const range = request.headers.get('range') ?? undefined;
    return { uuid, time, rawIpAddress, method, url, userAgent, referer, range, ulid, other };
}

function parseStringSet(commaDelimitedString: string | undefined): Set<string> {
    return new Set((commaDelimitedString  ?? '').split(',').map(v => v.trim()).filter(v => v !== ''));
}

async function computeResponse(request: Request, env: WorkerEnv, context: ModuleWorkerContext): Promise<Response> {
    const { instance, backendNamespace, productionDomain, cfAnalyticsToken, turnstileSitekey, turnstileSecretKey, podcastIndexCredentials, deploySha, deployTime, queue1: jobQueue, blobsBucket, roBlobsBucket, roRpcClientParams, kvNamespace } = env;
    IsolateId.log();
    const { origin, hostname, pathname, searchParams } = new URL(request.url);
    const { method, headers } = request;
    const adminTokens = parseStringSet(env.adminTokens);
    const previewTokens = parseStringSet(env.previewTokens);
    const productionOrigin = productionDomain ? `https://${productionDomain}` : origin;

    if (method === 'GET' && pathname === '/') return computeHomeResponse({ instance, origin, productionOrigin, cfAnalyticsToken, deploySha, deployTime });
    if (method === 'GET' && pathname === '/terms') return computeTermsResponse({ instance, hostname, origin, productionOrigin, productionDomain, cfAnalyticsToken });
    if (method === 'GET' && pathname === '/costs') return computeCostsResponse({ instance, hostname, origin, productionOrigin, cfAnalyticsToken });
    if (method === 'GET' && pathname === '/privacy') return computePrivacyResponse({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    if (method === 'GET' && pathname === '/download-calculation') return computeDownloadCalculationResponse({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    if (method === 'GET' && pathname === '/setup') return computeSetupResponse({ instance, origin, productionOrigin, cfAnalyticsToken, podcastIndexCredentials, previewTokens });
    if (method === 'GET' && pathname === '/info.json') return computeInfoResponse(env);
    if (method === 'GET' && pathname === '/api/docs') return computeApiDocsResponse({ instance, origin, cfAnalyticsToken });
    if (method === 'GET' && pathname === '/api/keys') return computeApiKeysResponse({ instance, origin, productionOrigin, cfAnalyticsToken, turnstileSitekey, previewTokens });
    if (method === 'GET' && pathname === '/api/docs/swagger.json') return computeApiDocsSwaggerResponse({ instance, origin, previewTokens });
    { const r = tryParseReleasesRequest({ method, pathname, headers }); if (r) return computeReleasesResponse(r, { instance, origin, productionOrigin, cfAnalyticsToken }); }
    if (method === 'GET' && pathname === '/robots.txt') return computeRobotsTxtResponse({ origin });
    if (method === 'GET' && pathname === '/sitemap.xml') return computeSitemapXmlResponse({ origin });
    const rpcClient = new CloudflareRpcClient(backendNamespace, 3);
    const background: Background = work => {
        context.waitUntil((async () => {
            try {
                await work();
            } catch (e) {
                consoleError('background', `Error in background: ${e.stack || e}`);
            }
        })());
    };
    const statsBlobs = blobsBucket ? new R2BucketBlobs({ bucket: blobsBucket, prefix: 'stats/' }) : undefined;
    const roStatsBlobs = roBlobsBucket ? new R2BucketBlobs({ bucket: roBlobsBucket, prefix: 'stats/', readonly: true }) : undefined;
    if (method === 'GET' && pathname === '/stats') return computeStatsResponse({ searchParams, instance, origin, productionOrigin, cfAnalyticsToken, statsBlobs, roStatsBlobs });

    const roRpcClient = roRpcClientParams ? ReadonlyRemoteDataRpcClient.ofParams(roRpcClientParams) : undefined;
    const configuration = kvNamespace ? new CloudflareConfiguration(kvNamespace) : undefined;
    { const r = tryParseShowRequest({ method, pathname }); if (r && configuration) return computeShowResponse(r, { searchParams, instance, hostname, origin, productionOrigin, cfAnalyticsToken, podcastIndexCredentials, adminTokens, previewTokens, rpcClient, roRpcClient, statsBlobs, roStatsBlobs, configuration }); }
    const apiRequest = tryParseApiRequest({ instance, method, hostname, origin, pathname, searchParams, headers, bodyProvider: () => request.json(), colo: computeColo(request) }); if (apiRequest) return await computeApiResponse(apiRequest, { rpcClient, adminTokens, previewTokens, turnstileSecretKey, podcastIndexCredentials, background, jobQueue, statsBlobs, roStatsBlobs, roRpcClient, configuration });

    // redirect /foo/ to /foo (canonical)
    if (method === 'GET' && pathname.endsWith('/')) return new Response(undefined, { status: 302, headers: { location: pathname.substring(0, pathname.length - 1) } });

    // not found
    if (method === 'GET') return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });

    return newMethodNotAllowedResponse(method);
}
