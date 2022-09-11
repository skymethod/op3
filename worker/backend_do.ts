import { BackendDOColo } from './backend_do_colo.ts';
import { Bytes, DurableObjectNamespace, DurableObjectState } from './deps.ts';
import { GetKeyRequest, GetKeyResponse, isRpcRequest, RpcResponse } from './rpc.ts';
import { IsolateId } from './isolate_id.ts';
import { WorkerEnv } from './worker_env.ts';
import { IpAddressHashingFn, RawRequestController } from './raw_request_controller.ts';
import { KeyClient, KeyFetcher } from './key_client.ts';
import { sendRpc } from './rpc_client.ts';
import { isValidIpAddressHmacKeyScope, KeyController } from './key_controller.ts';
import { hmac, importHmacKey } from './crypto.ts';

export class BackendDO {
    private readonly state: DurableObjectState;
    private readonly env: WorkerEnv;

    private rawRequestController: RawRequestController | undefined;
    private keyClient: KeyClient | undefined;

    private keyController: KeyController | undefined;

    constructor(state: DurableObjectState, env: WorkerEnv) {
        this.state = state;
        this.env = env;
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
                const { storage } = this.state;
                if (obj.kind === 'save-raw-requests') {
                    // save raw requests to storage
                    if (!this.keyClient) this.keyClient = newKeyClient(this.env.backendNamespace);
                    const keyClient = this.keyClient;
                    const hashIpAddress: IpAddressHashingFn = async (rawIpAddress, opts) => {
                        const key = await keyClient.getIpAddressHmacKey(opts.timestamp);
                        const signature = await hmac(Bytes.ofUtf8(rawIpAddress), key);
                        return `1:${signature.hex()}`;
                    }
                    if (!this.rawRequestController) this.rawRequestController = new RawRequestController(storage, colo, encryptIpAddress, hashIpAddress);
                    await this.rawRequestController.save(obj.rawRequests);
                    
                    const rpcResponse: RpcResponse = { kind: 'ok' };
                    return newRpcResponse(rpcResponse);
                } else if (obj.kind === 'get-key') {
                    // get or generate key
                    if (!this.keyController) this.keyController = new KeyController(storage);

                    const { keyType, keyScope } = obj;
                    const rawKeyBase64 = (await this.keyController.getOrGenerateKey(keyType, keyScope)).base64();

                    const rpcResponse: RpcResponse = { kind: 'get-key', rawKeyBase64 };
                    return newRpcResponse(rpcResponse);
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

//

async function encryptIpAddress(_rawIpAddress: string): Promise<string> {
    // TODO encrypt with reversible encryption
    await Promise.resolve();
    return `0:(encrypted)`;
}

function newKeyClient(backendNamespace: DurableObjectNamespace): KeyClient {
    const keyFetcher: KeyFetcher = async (keyType: string, keyScope: string) => {
        if (keyType === 'ip-address-hmac') {
            if (!isValidIpAddressHmacKeyScope(keyScope)) throw new Error(`Unsupported keyScope for ${keyType}: ${keyScope}`);

            const req: GetKeyRequest = { kind: 'get-key', keyType, keyScope };
            const res = await sendRpc<GetKeyResponse>(req, 'get-key', { backendNamespace, doName: 'key-server' });
            return await importHmacKey(Bytes.ofBase64(res.rawKeyBase64));
        }
        throw new Error(`Unsupported keyType: ${keyType}`);
    }
    return new KeyClient(keyFetcher);
}

function newRpcResponse(rpcResponse: RpcResponse): Response {
    return new Response(JSON.stringify(rpcResponse), { headers: { 'content-type': 'application/json' } });
}
