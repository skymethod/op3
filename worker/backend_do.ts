import { BackendDOColo } from './backend_do_colo.ts';
import { DurableObjectState } from './deps.ts';
import { isRpcRequest, RpcResponse } from './rpc.ts';
import { IsolateId } from './isolate_id.ts';

export class BackendDO {
    private readonly state: DurableObjectState;

    constructor(state: DurableObjectState) {
        this.state = state;
    }

    async fetch(request: Request): Promise<Response> {
        IsolateId.log();
        console.log(request.url);
        const colo = await BackendDOColo.get();
        const durableObjectName = request.headers.get('do-name');
        console.log('logprops:', { colo, durableObjectClass: 'BackendDO', durableObjectId: this.state.id.toString(), durableObjectName });

        // TODO init: register with a registry do

        try {
            const { method } = request;
            const { pathname } = new URL(request.url);
            if (method === 'POST' && pathname === '/rpc') {
                const obj = await request.json();
                if (!isRpcRequest(obj)) throw new Error(`Bad rpc request: ${JSON.stringify(obj)}`);
                if (obj.kind === 'save-raw-requests') {
                    // TODO save raw requests to storage
                    const rpcResponse: RpcResponse = { kind: 'ok' };
                    return new Response(JSON.stringify(rpcResponse), { headers: { 'content-type': 'application/json' } });
                } else {
                    throw new Error(`Unsupported rpc request: ${JSON.stringify(obj)}`);
                }
            }
            return new Response('not found', { status: 404 });
        } catch (e) {
            const msg = `Unhandled error in BackendDO.fetch: ${e.stack || e}`;
            console.error(msg);
            return new Response(msg, { status: 500 });
        }
    }

}
