import { computeOther, computeRawIpAddress } from './cloudflare_request.ts';
import { ModuleWorkerContext } from './deps.ts';
import { computeHomeResponse } from './home.ts';
import { computeInfoResponse } from './info.ts';
import { computeRawRequest, RawRequest } from './raw_request.ts';
import { computeRedirectResponse, tryParseRedirectRequest } from './redirect_episode.ts';
import { WorkerEnv } from './worker_env.ts';
import { IsolateId } from './isolate_id.ts';
import { computeApiResponse, tryParseApiRequest } from './api.ts';
import { CloudflareRpcClient } from './cloudflare_rpc_client.ts';
export { BackendDO } from './backend_do.ts';

export default {
    
    async fetch(request: Request, env: WorkerEnv, context: ModuleWorkerContext): Promise<Response> {
        const requestTime = Date.now();
        const { method } = request;
        const { instance, backendNamespace, dataset1 } = env;

        // first, handle redirects - the most important function
        // be careful here: must never throw
        const redirectRequest = tryParseRedirectRequest(request.url);
        if (redirectRequest) {
            const rawRequests = pendingRawRequests.splice(0);
            context.waitUntil((async () => {
                let colo = 'XXX';
                try {
                    IsolateId.log();
                    if (!backendNamespace) throw new Error(`backendNamespace not defined!`);
                    const rawIpAddress = computeRawIpAddress(request) ?? '<missing>';
                    const other = computeOther(request) ?? {};
                    other.isolateId = IsolateId.get();
                    const rawRequest = computeRawRequest(request, { time: requestTime, method, rawIpAddress, other });
                    console.log(`rawRequest: ${JSON.stringify({ ...rawRequest, rawIpAddress: '<hidden>' }, undefined, 2)}`);
                    
                    rawRequests.push(rawRequest);

                    colo = (other ?? {}).colo ?? colo;
                    const doName = `raw-request-${colo}`;
                    const rpcClient = new CloudflareRpcClient(backendNamespace);
                    await rpcClient.saveRawRequests({ rawRequests }, doName);
                    dataset1?.writeDataPoint({ blobs: [ 'success-saving-redirect', colo ], doubles: [ 1 ] });
                } catch (e) {
                    console.error(`Error sending raw requests: ${e.stack || e}`);
                    // we'll retry if this isolate gets hit again, otherwise lost
                    // TODO retry inline?
                    pendingRawRequests.push(...rawRequests);
                    dataset1?.writeDataPoint({ blobs: [ 'error-saving-redirect', colo, `${e.stack || e}`.substring(0, 1024) ], doubles: [ 1 ] });
                }
            })());
            console.log(`Redirecting to: ${redirectRequest.targetUrl}`);
            return computeRedirectResponse(redirectRequest);
        }

        // handle all other requests
        try {
            IsolateId.log();
            const { pathname } = new URL(request.url);
            const { headers } = request;
            const adminTokens = new Set((env.adminTokens ?? '').split(',').map(v => v.trim()).filter(v => v !== ''));

            if (method === 'GET' && pathname === '/') return computeHomeResponse({ instance });
            if (method === 'GET' && pathname === '/info.json') return computeInfoResponse(env);

            const rpcClient = new CloudflareRpcClient(backendNamespace);
            const apiRequest = tryParseApiRequest({ method, pathname, headers, bodyProvider: () => request.json() }); if (apiRequest) return await computeApiResponse(apiRequest, { rpcClient, adminTokens });

            return new Response('not found', { status: 404 });
        } catch (e) {
            console.error(`Unhandled error computing response: ${e.stack || e}`);
            return new Response('failed', { status: 500 });
        }
    }
    
}

//

const pendingRawRequests: RawRequest[] = [];
