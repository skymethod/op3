import { computeOther, computeRawIpAddress } from './cloudflare_request.ts';
import { ModuleWorkerContext } from './deps.ts';
import { computeHomeResponse } from './home.ts';
import { computeInfoResponse } from './info.ts';
import { computeRawRequest, RawRequest } from './raw_request.ts';
import { computeRedirectResponse, tryParseRedirectRequest } from './redirect_episode.ts';
import { WorkerEnv } from './worker_env.ts';
import { SaveRawRequestsRequest } from './rpc.ts';
import { sendRpc } from './rpc_client.ts';
export { BackendDO } from './backend_do.ts';

export default {
    
    fetch(request: Request, env: WorkerEnv, context: ModuleWorkerContext): Response {
        const requestTime = Date.now();
        const { method } = request;
        const { instance, backendNamespace } = env;

        // first, handle redirects - the most important function
        // be careful here: must never throw
        const redirectRequest = tryParseRedirectRequest(request.url);
        if (redirectRequest) {
            const rawRequests = pendingRawRequests.splice(0);
            context.waitUntil((async () => {
                try {
                    if (!backendNamespace) throw new Error(`backendNamespace not defined!`);
                    
                    const rawIpAddress = computeRawIpAddress(request) ?? '<missing>';
                    const other = computeOther(request);
                    const rawRequest = computeRawRequest(request, { time: requestTime, method, rawIpAddress, other });
                    console.log(`rawRequest: ${JSON.stringify({ ...rawRequest, rawIpAddress: '<hidden>' }, undefined, 2)}`);
                    
                    rawRequests.push(rawRequest);

                    const rpcRequest: SaveRawRequestsRequest = { kind: 'save-raw-requests', rawRequests };

                    const colo = (other ?? {}).colo ?? 'XXX';
                    const doName = `request-${colo}`;

                    await sendRpc(rpcRequest, 'ok', { doName, backendNamespace });
                } catch (e) {
                    console.error(`Error sending raw requests: ${e.stack || e}`);
                    // TODO send errors to backend as well?
                    pendingRawRequests.push(...rawRequests);
                }
            })());
            return computeRedirectResponse(redirectRequest);
        }

        // handle all other requests
        try {
            const { pathname } = new URL(request.url);

            if (method === 'GET' && pathname === '/') return computeHomeResponse({ instance });
            if (method === 'GET' && pathname === '/info.json') return computeInfoResponse(env);

            return new Response('not found', { status: 404 });
        } catch (e) {
            console.error(`Unhandled error computing response: ${e.stack || e}`);
            return new Response('failed', { status: 500 });
        }
    }
    
}

//

const pendingRawRequests: RawRequest[] = [];
