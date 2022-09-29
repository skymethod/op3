import { checkDeleteDurableObjectAllowed } from './admin_api.ts';
import { RpcClient } from '../rpc_model.ts';
import { newMethodNotAllowedResponse, newJsonResponse } from '../responses.ts';
import { computeQueryRedirectLogsResponse } from './api_query_redirect_logs.ts';
import { consoleError } from '../tracer.ts';

export function tryParseApiRequest(opts: { method: string, pathname: string, searchParams: URLSearchParams, headers: Headers, bodyProvider: JsonProvider }): ApiRequest | undefined {
    const { method, pathname, searchParams, headers, bodyProvider } = opts;
    const m = /^\/api\/1(\/[a-z\/-]+)$/.exec(pathname);
    if (!m) return undefined;
    const [ _, path ] = m;
    const m2 = /^bearer (.*?)$/i.exec(headers.get('authorization') ?? '');
    const bearerToken = m2 ? m2[1] : undefined;
    return { method, path, searchParams, bearerToken, bodyProvider };
}

// deno-lint-ignore no-explicit-any
type JsonProvider = () => Promise<any>;

export async function computeApiResponse(request: ApiRequest, opts: { rpcClient: RpcClient, adminTokens: Set<string>, previewTokens: Set<string> }): Promise<Response> {
    const { method, path, searchParams, bearerToken, bodyProvider } = request;
    const { rpcClient, adminTokens, previewTokens } = opts;

    const identity = computeIdentity(bearerToken, searchParams, adminTokens, previewTokens);
    console.log(`computeApiResponse`, { method, path, identity });

    // all api endpoints required auth
    if (identity === undefined) return newJsonResponse({ error: 'unauthorized' }, 401);

    // unknown token
    if (identity === 'invalid') return newJsonResponse({ error: 'forbidden' }, 403);

    try {
        if (path.startsWith('/admin/')) {
            // admin endpoints require admin
            if (identity !== 'admin') return newJsonResponse({ error: 'forbidden' }, 403);

            if (path === '/admin/data') return await computeAdminDataResponse(method, bodyProvider, rpcClient);
            if (path === '/admin/rebuild-index') return await computeAdminRebuildResponse(method, bodyProvider, rpcClient);
            if (path === '/admin/metrics') return await computeAdminGetMetricsResponse(method, rpcClient);
        } else {
            if (path === '/redirect-logs') return await computeQueryRedirectLogsResponse(method, searchParams, rpcClient);
        }
    } catch (e) {
        const error = `${e.stack || e}`;
        consoleError('api-call', `Error in api call: ${error}`);
        return newJsonResponse({ error }, 500);
    }

    // unknown api endpoint
    return newJsonResponse({ error: 'not found' }, 404);
}

export interface ApiRequest {
    readonly method: string;
    readonly path: string;
    readonly searchParams: URLSearchParams;
    readonly bearerToken?: string;
    readonly bodyProvider: JsonProvider;
}

//

type Identity = 'admin' | 'preview' | 'invalid';

//

function computeIdentity(bearerToken: string | undefined, searchParams: URLSearchParams, adminTokens: Set<string>, previewTokens: Set<string>): Identity | undefined {
    const token = typeof bearerToken === 'string' ? bearerToken : searchParams.get('token') ?? undefined;
    if (token === undefined) return undefined;
    if (adminTokens.has(token)) return 'admin';
    if (previewTokens.has(token)) return 'preview';
    return 'invalid';
}

async function computeAdminDataResponse(method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

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
}

async function computeAdminRebuildResponse(method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

    const { indexName, start, inclusive, limit } = await bodyProvider();

    if (typeof indexName !== 'string') throw new Error(`Bad indexName: ${indexName}`);
    if (typeof start !== 'string') throw new Error(`Bad start: ${start}`);
    if (typeof inclusive !== 'boolean') throw new Error(`Bad inclusive: ${inclusive}`);
    if (typeof limit !== 'number') throw new Error(`Bad limit: ${limit}`);

    const { first, last, count, millis } = await rpcClient.adminRebuildIndex({ indexName, start, inclusive, limit }, 'combined-redirect-log');
    return newJsonResponse({ first, last, count, millis });
}

async function computeAdminGetMetricsResponse(method: string, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    return await rpcClient.getMetrics({}, 'combined-redirect-log');
}
