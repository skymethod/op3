import { DurableObjectNamespace } from './deps.ts';
import { AdminDataResponse } from './rpc.ts';
import { sendRpc } from './rpc_client.ts';

export function tryParseApiRequest(opts: { method: string, pathname: string, headers: Headers, bodyProvider: JsonProvider }): ApiRequest | undefined {
    const { method, pathname, headers, bodyProvider } = opts;
    const m = /^\/api\/1(\/[a-z\/]+)$/.exec(pathname);
    if (!m) return undefined;
    const [ _, path ] = m;
    const m2 = /^bearer (.*?)$/i.exec(headers.get('authorization') ?? '');
    const bearerToken = m2 ? m2[1] : undefined;
    return { method, path, bearerToken, bodyProvider };
}

// deno-lint-ignore no-explicit-any
type JsonProvider = () => Promise<any>;

export async function computeApiResponse(request: ApiRequest, opts: { backendNamespace: DurableObjectNamespace, adminTokens: Set<string> }): Promise<Response> {
    console.log(`computeApiResponse`, request);
    const { method, path, bearerToken, bodyProvider } = request;
    const { backendNamespace, adminTokens } = opts;

    if (path.startsWith('/admin/')) {
        if (typeof bearerToken !== 'string') return new Response('unauthorized', { status: 401 });
        const isAdmin = adminTokens.has(bearerToken);
        if (!isAdmin) return new Response('forbidden', { status: 403 });

        try {
            if (path === '/admin/data') {
                if (method === 'POST') {
                    const { operationKind, targetPath } = await bodyProvider();
                    if (operationKind === 'list' && targetPath === '/registry') {
                        const { listResults } = await sendRpc<AdminDataResponse>({ kind: 'admin-data', operationKind, targetPath }, 'admin-data', { doName: 'registry', backendNamespace });
                        return newJsonResponse({ listResults });
                    } else if (operationKind === 'list' && targetPath === '/keys') {
                        const { listResults } = await sendRpc<AdminDataResponse>({ kind: 'admin-data', operationKind, targetPath }, 'admin-data', { doName: 'key-server', backendNamespace });
                        return newJsonResponse({ listResults });
                    } else {
                        throw new Error(`Unsupported operationKind ${operationKind} and targetPath ${targetPath}`);
                    }
                } else {
                    return new Response(`${method} not allowed`, { status: 405 });
                }
            }
        } catch (e) {
            const error = `${e.stack || e}`;
            console.error(`Error in api call: ${error}`);
            return newJsonResponse({ error }, 500);
        }
    }
    return newJsonResponse({ error: 'not found' }, 404);
}

export interface ApiRequest {
    readonly method: string;
    readonly path: string;
    readonly bearerToken?: string;
    readonly bodyProvider: JsonProvider;
}

//

function newJsonResponse(obj: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(obj, undefined, 2), { status, headers: { 'content-type': 'application/json' } });
}
