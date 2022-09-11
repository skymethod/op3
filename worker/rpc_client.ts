import { DurableObjectNamespace } from './deps.ts';
import { isRpcResponse, RpcRequest, RpcResponse } from './rpc.ts';

export async function sendRpc<T extends RpcResponse>(request: RpcRequest, expectedResponseKind: string, opts: { doName: string, backendNamespace: DurableObjectNamespace }): Promise<T> {
    const { doName, backendNamespace } = opts;

    // TODO: retry on known transient DO errors
    const stub = backendNamespace.get(backendNamespace.idFromName(doName));
    const res = await stub.fetch('https://backend/rpc', { method: 'POST', body: JSON.stringify(request), headers: { 'do-name': doName } });

    if (res.status !== 200) throw new Error(`Bad rpc status: ${res.status}, body=${await res.text()}`);
    const contentType = res.headers.get('content-type');
    if (contentType !== 'application/json') throw new Error(`Bad content-type: ${contentType}`);
    const obj = await res.json();
    if (!isRpcResponse(obj)) throw new Error(`Bad rpc response: ${JSON.stringify(obj)}`);
    if (obj.kind === 'error') throw new Error(`Rpc error: ${obj.message}`);
    if (obj.kind !== expectedResponseKind) throw new Error(`Unexpected rpc response: ${JSON.stringify(obj)}`);
    // deno-lint-ignore no-explicit-any
    return obj as any;
}
