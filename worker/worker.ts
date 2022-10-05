import { computeOther, computeRawIpAddress } from './cloudflare_request.ts';
import { ModuleWorkerContext } from './deps.ts';
import { computeHomeResponse } from './routes/home.ts';
import { computeInfoResponse } from './routes/info.ts';
import { computeRedirectResponse, tryParseRedirectRequest } from './routes/redirect_episode.ts';
import { WorkerEnv } from './worker_env.ts';
import { IsolateId } from './isolate_id.ts';
import { computeApiResponse, tryParseApiRequest } from './routes/api.ts';
import { CloudflareRpcClient } from './cloudflare_rpc_client.ts';
import { generateUuid } from './uuid.ts';
import { tryParseUlid } from './ulid.ts';
import { RawRedirect } from './rpc_model.ts';
import { computeApiDocsResponse } from './routes/api_docs.ts';
import { computeApiDocsSwaggerResponse } from './routes/api_docs_swagger.ts';
import { computeTermsResponse } from './routes/terms.ts';
import { computePrivacyResponse } from './routes/privacy.ts';
import { computeReleasesResponse, tryParseReleasesRequest } from './routes/releases.ts';
import { compute404Response } from './routes/404.ts';
import { newMethodNotAllowedResponse } from './responses.ts';
import { computeRobotsTxtResponse, computeSitemapXmlResponse } from './routes/robots.ts';
import { consoleError, writeTraceEvent } from './tracer.ts';
import { computeChainDestinationHostname } from './chain_estimate.ts';
import { initCloudflareTracer } from './cloudflare_tracer.ts';
export { BackendDO } from './backend/backend_do.ts';

export default {
    
    async fetch(request: Request, env: WorkerEnv, context: ModuleWorkerContext): Promise<Response> {
        const requestTime = Date.now();

        initCloudflareTracer(env.dataset1);
       
        // first, handle redirects - the most important function
        // be careful here: must never throw
        const redirectResponse = tryComputeRedirectResponse(request, { env, context, requestTime });
        if (redirectResponse) return redirectResponse;

        // handle all other requests
        let response: Response;
        try {
            response = await computeResponse(request, env);
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
    }
    
}

//

const pendingRawRedirects: RawRedirect[] = [];

function tryComputeRedirectResponse(request: Request, opts: { env: WorkerEnv, context: ModuleWorkerContext, requestTime: number }): Response | undefined {
    // must never throw!
    const redirectRequest = tryParseRedirectRequest(request.url);
    if (!redirectRequest) return undefined;

    const { env, context, requestTime } = opts;
    const rawRedirects = pendingRawRedirects.splice(0);
    // do the expensive work after quickly returning the redirect response
    context.waitUntil((async () => {
        const { backendNamespace } = env;
        const { method } = request;
        let colo = 'XXX';
        try {
            IsolateId.log();
            if (!backendNamespace) throw new Error(`backendNamespace not defined!`);
            
            if (redirectRequest.kind === 'valid') {
                const rawIpAddress = computeRawIpAddress(request) ?? '<missing>';
                const other = computeOther(request) ?? {};
                colo = (other ?? {}).colo ?? colo;
                other.isolateId = IsolateId.get();
                const rawRedirect = computeRawRedirect(request, { time: requestTime, method, rawIpAddress, other });
                console.log(`rawRedirect: ${JSON.stringify({ ...rawRedirect, rawIpAddress: '<hidden>' }, undefined, 2)}`);
                rawRedirects.push(rawRedirect);
            }
            
            if (rawRedirects.length > 0) {
                const doName = `redirect-log-${colo}`;
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
                return { kind: redirectRequest.kind === 'valid' ? 'valid-redirect' : 'invalid-redirect', colo, url, country, destinationHostname, userAgent, referer };
            });
        }
    })());
    if (redirectRequest.kind === 'valid') {
        console.log(`Redirecting to: ${redirectRequest.targetUrl}`);
        return computeRedirectResponse(redirectRequest);
    } else {
        console.log(`Invalid redirect url: ${request.url}`);
        return new Response('Invalid redirect url', { status: 400 });
    }
}

function computeRawRedirect(request: Request, opts: { time: number, method: string, rawIpAddress: string, other?: Record<string, string> }): RawRedirect {
    const { time, method, rawIpAddress, other } = opts;
    const uuid = generateUuid();
    const { url, ulid } = tryParseUlid(request.url);
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const referer = request.headers.get('referer') ?? undefined;
    const range = request.headers.get('range') ?? undefined;
    return { uuid, time, rawIpAddress, method, url, userAgent, referer, range, ulid, other };
}

function parseStringSet(commaDelimitedString: string | undefined): Set<string> {
    return new Set((commaDelimitedString  ?? '').split(',').map(v => v.trim()).filter(v => v !== ''));
}

async function computeResponse(request: Request, env: WorkerEnv): Promise<Response> {
        const { instance, backendNamespace, productionDomain, cfAnalyticsToken, deploySha, deployTime } = env;
        IsolateId.log();
        const { origin, hostname, pathname, searchParams } = new URL(request.url);
        const { method, headers } = request;
        const adminTokens = parseStringSet(env.adminTokens);
        const previewTokens = parseStringSet(env.previewTokens);
        const productionOrigin = productionDomain ? `https://${productionDomain}` : origin;

        if (method === 'GET' && pathname === '/') return computeHomeResponse({ instance, origin, productionOrigin, cfAnalyticsToken, deploySha, deployTime });
        if (method === 'GET' && pathname === '/terms') return computeTermsResponse({ instance, hostname, origin, productionOrigin, productionDomain, cfAnalyticsToken });
        if (method === 'GET' && pathname === '/privacy') return computePrivacyResponse({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
        if (method === 'GET' && pathname === '/info.json') return computeInfoResponse(env);
        if (method === 'GET' && pathname === '/api/docs') return computeApiDocsResponse({ instance, origin, cfAnalyticsToken });
        if (method === 'GET' && pathname === '/api/docs/swagger.json') return computeApiDocsSwaggerResponse({ instance, origin, previewTokens });
        const releasesRequest = tryParseReleasesRequest({ method, pathname, headers }); if (releasesRequest) return computeReleasesResponse(releasesRequest, { instance, origin, productionOrigin, cfAnalyticsToken });
        if (method === 'GET' && pathname === '/robots.txt') return computeRobotsTxtResponse({ origin });
        if (method === 'GET' && pathname === '/sitemap.xml') return computeSitemapXmlResponse({ origin });
        const rpcClient = new CloudflareRpcClient(backendNamespace, 3);
        const apiRequest = tryParseApiRequest({ method, pathname, searchParams, headers, bodyProvider: () => request.json() }); if (apiRequest) return await computeApiResponse(apiRequest, { rpcClient, adminTokens, previewTokens });

        // redirect /foo/ to /foo (canonical)
        if (method === 'GET' && pathname.endsWith('/')) return new Response(undefined, { status: 302, headers: { location: pathname.substring(0, pathname.length - 1) } });

        // not found
        if (method === 'GET') return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });

        return newMethodNotAllowedResponse(method);

}
