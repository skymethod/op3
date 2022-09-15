import { computeColo, computeOther, computeRawIpAddress } from './cloudflare_request.ts';
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
export { BackendDO } from './backend/backend_do.ts';

export default {
    
    async fetch(request: Request, env: WorkerEnv, context: ModuleWorkerContext): Promise<Response> {
        const requestTime = Date.now();
       
        // first, handle redirects - the most important function
        // be careful here: must never throw
        const redirectResponse = tryComputeRedirectResponse(request, { env, context, requestTime });
        if (redirectResponse) return redirectResponse;

        // handle all other requests
        try {
            const { instance, backendNamespace } = env;
            IsolateId.log();
            const { origin, pathname, searchParams } = new URL(request.url);
            const { method, headers } = request;
            const adminTokens = parseStringSet(env.adminTokens);
            const previewTokens = parseStringSet(env.previewTokens);

            if (method === 'GET' && pathname === '/') return computeHomeResponse({ instance });
            if (method === 'GET' && pathname === '/info.json') return computeInfoResponse(env);
            if (method === 'GET' && pathname === '/api/docs') return computeApiDocsResponse({ instance });
            if (method === 'GET' && pathname === '/api/docs/swagger.json') return computeApiDocsSwaggerResponse({ instance, origin, previewTokens });

            const rpcClient = new CloudflareRpcClient(backendNamespace);
            const apiRequest = tryParseApiRequest({ method, pathname, searchParams, headers, bodyProvider: () => request.json() }); if (apiRequest) return await computeApiResponse(apiRequest, { rpcClient, adminTokens, previewTokens });

            return new Response('not found', { status: 404 });
        } catch (e) {
            console.error(`Unhandled error computing response: ${e.stack || e}`);
            return new Response('failed', { status: 500 });
        }
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
        const { backendNamespace, dataset1 } = env;
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
                const rpcClient = new CloudflareRpcClient(backendNamespace);
                await rpcClient.logRawRedirects({ rawRedirects }, doName);
            }
        } catch (e) {
            console.error(`Error sending raw redirects: ${e.stack || e}`);
            // we'll retry if this isolate gets hit again, otherwise lost
            // TODO retry inline?
            pendingRawRedirects.push(...rawRedirects);
            colo = computeColo(request) ?? colo;
            dataset1?.writeDataPoint({ blobs: [ 'error-saving-redirect', colo, `${e.stack || e}`.substring(0, 1024) ], doubles: [ 1 ] });
        } finally {
            if (colo === 'XXX') colo = computeColo(request) ?? colo;
            dataset1?.writeDataPoint({ blobs: [ redirectRequest.kind === 'valid' ? 'valid-redirect' : 'invalid-redirect', colo, request.url.substring(0, 1024) ], doubles: [ 1 ] });
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
