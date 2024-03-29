import { computeOther, computeRawIpAddress, tryComputeColo } from './cloudflare_request.ts';
import { CfGlobalCaches, ModuleWorkerContext, QueueMessageBatch, R2Bucket } from './deps.ts';
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
import { initCloudflareTracer, setWorkerInfo } from './cloudflare_tracer.ts';
import { computeCostsResponse } from './routes/costs.ts';
import { computeApiKeysResponse } from './routes/api_keys.ts';
import { computeSetupResponse } from './routes/setup.ts';
import { DoNames } from './do_names.ts';
import { Banlist } from './banlist.ts';
import { ManualColo } from './backend/manual_colo.ts';
import { R2BucketBlobs } from './backend/r2_bucket_blobs.ts';
import { ReadonlyRemoteDataRpcClient } from './rpc_clients.ts';
import { computeDemoShowResponse, computeShowOgImageResponse, computeShowResponse, tryParseShowOgImageRequest, tryParseShowRequest } from './routes/show.ts';
import { CloudflareConfiguration } from './cloudflare_configuration.ts';
import { computeDownloadCalculationResponse } from './routes/download_calculation.ts';
import { computeStatsResponse } from './routes/stats.ts';
import { computeStatusResponse, tryParseStatusRequest } from './routes/status.ts';
import { computeListenTimeCalculationResponse } from './routes/listen_time_calculation.ts';
import { Configuration, makeCachedConfiguration } from './configuration.ts';
export { BackendDO } from './backend/backend_do.ts';

export default {
    
    async fetch(request: Request, env: WorkerEnv, context: ModuleWorkerContext): Promise<Response> {
        try {
            const requestTime = Date.now();

            initCloudflareTracer(env.dataset1);
            const colo = tryComputeColo(request);
            setWorkerInfo({ colo: colo ?? 'XXX', name: 'eyeball' });

            if (!banlist) banlist = new Banlist(env.kvNamespace, (globalThis.caches as unknown as CfGlobalCaches).default);
        
            // first, handle redirects - the most important function
            // be careful here: must never throw
            const redirectResponse = await tryComputeRedirectResponse(request, { env, context, requestTime });
            if (redirectResponse) return redirectResponse;

            // handle all other requests
            let response: Response;
            try {
                response = await computeResponse(request, colo, env, context);
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
                const { pathname, search } = new URL(request.url);
                const contentType = response.headers.get('content-type') ?? '<unspecified>';
                return { kind: 'worker-request', colo, pathname, search, country, method, contentType, millis, status };
            });

            return response;
        } catch (e) {
            consoleError('worker-unhandled', `Unhandled error in worker fetch: ${e.stack || e}`);
            return new Response('failed', { status: 500 });
        }
    },

    async queue(batch: QueueMessageBatch, env: WorkerEnv) {
        try {
            const consumerStart = Date.now();
            const { dataset1, backendNamespace, blobsBucket, queue1Name, queue2Name } = env;
            initCloudflareTracer(dataset1);
            const colo = await ManualColo.get();
            setWorkerInfo({ colo, name: 'eyeball' });

            const rpcClient = new CloudflareRpcClient(backendNamespace, 3);

            if (batch.queue === queue1Name) {
                // admin data job

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
            } else if (batch.queue === queue2Name) {
                // raw redirects batch
                
                const batchUuid = generateUuid();
                const rawRedirectsByMessageId: Record<string, { rawRedirects: RawRedirect[], timestamp: string }> = {};
                for (const msg of batch.messages) {
                    const { body, id, timestamp } = msg;
                    const rawRedirects = body as RawRedirect[];
                    rawRedirectsByMessageId[id] = { rawRedirects, timestamp: timestamp.toISOString() };
                }
                const response = await rpcClient.logRawRedirectsBatch({ rawRedirectsByMessageId, rpcSentTime: new Date().toISOString() }, DoNames.hitsServer);
                const { processedMessageIds, colo: doColo, rpcSentTime, rpcReceivedTime, minTimestamp, medTimestamp, maxTimestamp, messageCount, redirectCount, putCount, evictedCount, times: { packRawRedirects, saveAttNums, ensureMinuteFileLoaded, saveMinuteFile } } = response;
                const messageIds = new Set(processedMessageIds);
                for (const msg of batch.messages) {
                    if (messageIds.has(msg.id)) {
                        msg.ack();
                    } else {
                        msg.retry();
                    }
                }
                const consumerStartTime = new Date(consumerStart).toISOString();
                const consumerTime = Date.now() - consumerStart;
                const doubles: number[] = [ messageCount, redirectCount, putCount, evictedCount ];
                const times: number[] = [ consumerTime, packRawRedirects, saveAttNums, ensureMinuteFileLoaded, saveMinuteFile ];
                writeTraceEvent({ kind: 'generic', type: 'hits-batch',
                    strings: [ batchUuid, colo, doColo, rpcSentTime, rpcReceivedTime, minTimestamp ?? '', medTimestamp ?? '', maxTimestamp ?? '', consumerStartTime ],
                    doubles: [ ...doubles, ...Array(20 - doubles.length - times.length).fill(0), ...times.reverse() ],
                });
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
let cachedConfiguration: Configuration | undefined;

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
        let rawIpAddress = '';
        try {
            IsolateId.log();
            if (!backendNamespace) throw new Error(`backendNamespace not defined!`);
            
            rawIpAddress = computeRawIpAddress(request.headers) ?? '<missing>';
            if (redirectRequest.kind === 'valid' && !banned) {
                const other = computeOther(request) ?? {};
                colo = (other ?? {}).colo ?? colo;
                other.isolateId = IsolateId.get();
                const rawRedirect = computeRawRedirect(request, { time: requestTime, method, rawIpAddress, other });
                console.log(`rawRedirect: ${JSON.stringify({ ...rawRedirect, rawIpAddress: '<hidden>' }, undefined, 2)}`);
                rawRedirects.push(rawRedirect);
            }
            
            if (rawRedirects.length > 0) {
                // send raw redirects the current way
                const doName = DoNames.redirectLogForColo(colo);
                const rpcClient = new CloudflareRpcClient(backendNamespace, 5);
                await rpcClient.logRawRedirects({ rawRedirects }, doName);

                // send raw redirects the future way, if enabled
                try {
                    const { kvNamespace, queue2 } = env;
                    if (kvNamespace && queue2) {
                        if (!cachedConfiguration) cachedConfiguration = makeCachedConfiguration(new CloudflareConfiguration(kvNamespace), () => 1000 * 60); // cache config values for one minute
                        if (await cachedConfiguration.get('hits-queue') === 'enabled') {
                            await queue2.send(rawRedirects, { contentType: 'json' });
                        }
                    }
                } catch (e) {
                    consoleError('worker-sending-redirects-message', `Error sending raw redirects message: ${e.stack || e}`)
                }
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
                const hasForwarded = headers.has('forwarded');
                const hasXForwardedFor = headers.has('x-forwarded-for');
                const ipAddressShape = rawIpAddress === '<missing>' ? '' : rawIpAddress.replaceAll(/[a-z]/g, 'a').replaceAll(/[A-Z]/g, 'A').replaceAll(/\d/g, 'n');
                const ipAddressVersion = /^n{1,3}\.n{1,3}\.n{1,3}\.n{1,3}$/.test(ipAddressShape) ? 4 : ipAddressShape.includes(':') ? 6 : 0;
                return { kind: banned ? 'banned-redirect' : redirectRequest.kind === 'valid' ? 'valid-redirect' : 'invalid-redirect', colo, url, country, destinationHostname, userAgent, referer, hasForwarded, hasXForwardedFor, ipAddressShape, ipAddressVersion };
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
    const xpsId = request.headers.get('x-playback-session-id') ?? undefined;
    return { uuid, time, rawIpAddress, method, url, userAgent, referer, range, ulid, xpsId, other };
}

function parseStringSet(commaDelimitedString: string | undefined): Set<string> {
    return new Set((commaDelimitedString  ?? '').split(',').map(v => v.trim()).filter(v => v !== ''));
}

async function computeResponse(request: Request, colo: string | undefined, env: WorkerEnv, context: ModuleWorkerContext): Promise<Response> {
    const { instance, backendNamespace, productionDomain, cfAnalyticsToken, turnstileSitekey, turnstileSecretKey, podcastIndexCredentials, deploySha, deployTime, queue1: jobQueue, blobsBucket, roBlobsBucket, roRpcClientParams, kvNamespace } = env;
    IsolateId.log();
    const { origin, hostname, pathname, searchParams, protocol } = new URL(request.url);
    const { method, headers } = request;
    const acceptsHtml = /html/i.test(headers.get('accept') ?? '');
    const acceptLanguage = headers.get('accept-language') ?? undefined;
    const adminTokens = parseStringSet(env.adminTokens);
    const previewTokens = parseStringSet(env.previewTokens);
    const productionOrigin = productionDomain ? `https://${productionDomain}` : origin;

    if (protocol === 'http:' && env.origin?.startsWith('https:')) return computeHttpToHttpsRedirectResponse(request.url); // redirect http -> https for all non-episode-redirect requests
    if (method === 'GET' && pathname === '/') return computeHomeResponse({ instance, origin, productionOrigin, cfAnalyticsToken, deploySha, deployTime, searchParams, acceptLanguage });
    if (method === 'GET' && pathname === '/terms') return computeTermsResponse({ instance, hostname, origin, productionOrigin, productionDomain, cfAnalyticsToken });
    if (method === 'GET' && pathname === '/costs') return computeCostsResponse({ instance, hostname, origin, productionOrigin, cfAnalyticsToken });
    if (method === 'GET' && pathname === '/privacy') return computePrivacyResponse({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    if (method === 'GET' && pathname === '/download-calculation') return computeDownloadCalculationResponse({ instance, origin, hostname, productionOrigin, cfAnalyticsToken, acceptLanguage, searchParams });
    if (method === 'GET' && pathname === '/listen-time-calculation') return computeListenTimeCalculationResponse({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    if (method === 'GET' && pathname === '/demo') return computeDemoShowResponse({ origin, searchParams });
    if (method === 'GET' && pathname === '/setup') return computeSetupResponse({ instance, origin, productionOrigin, cfAnalyticsToken, podcastIndexCredentials, previewTokens, acceptLanguage, searchParams });
    if (method === 'GET' && pathname === '/info.json') return computeInfoResponse(env);
    if (method === 'GET' && pathname === '/api' && acceptsHtml) return new Response('', { status: 302, headers: { location: '/api/docs' } });
    if (method === 'GET' && pathname === '/api/keys') return computeApiKeysResponse({ instance, origin, productionOrigin, cfAnalyticsToken, turnstileSitekey, previewTokens });
    const configuration = kvNamespace ? new CloudflareConfiguration(kvNamespace) : undefined;
    if (method === 'GET' && pathname === '/api/docs') return computeApiDocsResponse({ instance, origin, searchParams, cfAnalyticsToken, configuration, previewTokens });
    if (method === 'GET' && pathname === '/api/docs/swagger.json') return await computeApiDocsSwaggerResponse({ instance, origin, previewTokens, configuration, searchParams });
    { const r = tryParseReleasesRequest({ method, pathname, headers }); if (r) return computeReleasesResponse(r, { instance, origin, productionOrigin, cfAnalyticsToken }); }
    if (method === 'GET' && pathname === '/robots.txt') return computeRobotsTxtResponse({ origin });
    if (method === 'GET' && pathname === '/sitemap.xml') return computeSitemapXmlResponse({ origin });
    const rpcClient = new CloudflareRpcClient(backendNamespace, 3);
    { const r = tryParseStatusRequest({ method, pathname, headers }); if (r) return await computeStatusResponse(r, { instance, origin, productionOrigin, cfAnalyticsToken, rpcClient }); }

    const background: Background = work => {
        context.waitUntil((async () => {
            try {
                await work();
            } catch (e) {
                consoleError('background', `Error in background: ${e.stack || e}`);
            }
        })());
    };

    const { blobs: statsBlobs, roBlobs: roStatsBlobs } = initBlobs({ blobsBucket, roBlobsBucket, prefix: 'stats/' });
    if (method === 'GET' && pathname === '/stats' && !/staging|prod/.test(instance)) return computeStatsResponse({ searchParams, instance, origin, productionOrigin, cfAnalyticsToken, statsBlobs, roStatsBlobs });

    const roRpcClient = roRpcClientParams ? ReadonlyRemoteDataRpcClient.ofParams(roRpcClientParams) : undefined;
    const { blobs: assetBlobs, roBlobs: roAssetBlobs } = initBlobs({ blobsBucket, roBlobsBucket, prefix: 'assets/' });
    { const r = tryParseShowRequest({ method, pathname, acceptLanguage }); if (r && configuration) return computeShowResponse(r, { searchParams, instance, hostname, origin, productionOrigin, cfAnalyticsToken, podcastIndexCredentials, previewTokens, rpcClient, roRpcClient, statsBlobs, roStatsBlobs, configuration, assetBlobs, roAssetBlobs }); }
    { const r = tryParseShowOgImageRequest({ method, pathname }); if (r && configuration) return computeShowOgImageResponse(r, { searchParams, instance, hostname, origin, productionOrigin, cfAnalyticsToken, podcastIndexCredentials, previewTokens, rpcClient, roRpcClient, statsBlobs, roStatsBlobs, configuration, assetBlobs, roAssetBlobs }); }
    const { blobs: miscBlobs, roBlobs: roMiscBlobs } = initBlobs({ blobsBucket, roBlobsBucket, prefix: 'misc/' });
    const { blobs: hitsBlobs, roBlobs: roHitsBlobs } = initBlobs({ blobsBucket, roBlobsBucket, prefix: 'hits/' });
    const apiRequest = tryParseApiRequest({ instance, method, hostname, origin, pathname, searchParams, headers, bodyProvider: () => request.json(), colo }); if (apiRequest) return await computeApiResponse(apiRequest, { rpcClient, adminTokens, previewTokens, turnstileSecretKey, podcastIndexCredentials, background, jobQueue, statsBlobs, roStatsBlobs, roRpcClient, configuration, miscBlobs, roMiscBlobs, hitsBlobs, roHitsBlobs });

    // redirect /foo/ to /foo (canonical)
    if (method === 'GET' && pathname.endsWith('/')) return new Response(undefined, { status: 302, headers: { location: pathname.substring(0, pathname.length - 1) } });

    // not found
    if (method === 'GET') return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });

    return newMethodNotAllowedResponse(method);
}

function initBlobs({ blobsBucket, roBlobsBucket, prefix }: { blobsBucket?: R2Bucket, roBlobsBucket?: R2Bucket, prefix: string }) {
    const blobs = blobsBucket ? new R2BucketBlobs({ bucket: blobsBucket, prefix }) : undefined;
    const roBlobs = roBlobsBucket ? new R2BucketBlobs({ bucket: roBlobsBucket, prefix, readonly: true }) : undefined;
    return { blobs, roBlobs };
}

function computeHttpToHttpsRedirectResponse(requestUrl: string): Response {
    return new Response(undefined, { status: 308 /* perm redirect, don't change method */, headers: { 'cache-control': 'private, no-cache', 'access-control-allow-origin': '*', 'location': `https://${requestUrl.substring('http://'.length)}` } });
}
