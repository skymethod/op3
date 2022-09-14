import { checkDeleteDurableObjectAllowed } from './admin_api.ts';
import { RpcClient } from '../rpc_model.ts';

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

export async function computeApiResponse(request: ApiRequest, opts: { rpcClient: RpcClient, adminTokens: Set<string> }): Promise<Response> {
    const { method, path, bearerToken, bodyProvider } = request;
    const { rpcClient, adminTokens } = opts;

    console.log(`computeApiResponse`, { method, path, hasBearerToken: typeof bearerToken === 'string' });

    if (path.startsWith('/admin/')) {
        if (typeof bearerToken !== 'string') return newJsonResponse({ error: 'unauthorized' }, 401);
        const isAdmin = adminTokens.has(bearerToken);
        if (!isAdmin) return newJsonResponse({ error: 'forbidden' }, 403);

        try {
            if (path === '/admin/data') return await computeAdminDataResponse(method, bodyProvider, rpcClient);
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

async function computeAdminDataResponse(method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (method === 'POST') {
        const { operationKind, targetPath, dryRun } = await bodyProvider();
        if (operationKind === 'list' && targetPath === '/registry') {
            const { listResults } = await rpcClient.executeAdminDataQuery({ operationKind, targetPath, dryRun }, 'registry');
            return newJsonResponse({ listResults });
        } else if (operationKind === 'list' && targetPath === '/keys') {
            const { listResults } = await rpcClient.executeAdminDataQuery({ operationKind, targetPath, dryRun }, 'key-server');
            return newJsonResponse({ listResults });
        } else if (operationKind === 'list' && targetPath.startsWith('/crl/')) {
            const { listResults } = await rpcClient.executeAdminDataQuery({ operationKind, targetPath, dryRun }, 'combined-redirect-log');
            return newJsonResponse({ listResults });
        } else if (operationKind === 'list' && targetPath === '/crl/records') {
            const { listResults } = await rpcClient.executeAdminDataQuery({ operationKind, targetPath, dryRun }, 'combined-redirect-log');
            return newJsonResponse({ listResults });
        } else if (operationKind === 'delete' && targetPath.startsWith('/durable-object/')) {
            const doName = checkDeleteDurableObjectAllowed(targetPath);
            const { message } = await rpcClient.executeAdminDataQuery({ operationKind, targetPath, dryRun }, doName);
            return newJsonResponse({ message });
        } else {
            throw new Error(`Unsupported operationKind ${operationKind} and targetPath ${targetPath}`);
        }
    } else {
        return new Response(`${method} not allowed`, { status: 405 });
    }
}
