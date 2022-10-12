import { checkDeleteDurableObjectAllowed } from './admin_api.ts';
import { ApiTokenPermission, RpcClient } from '../rpc_model.ts';
import { newMethodNotAllowedResponse, newJsonResponse } from '../responses.ts';
import { computeQueryRedirectLogsResponse } from './api_query_redirect_logs.ts';
import { consoleError } from '../tracer.ts';
import { computeRawIpAddress } from '../cloudflare_request.ts';
import { isValidUuid } from '../uuid.ts';

export function tryParseApiRequest(opts: { instance: string, method: string, hostname: string, pathname: string, searchParams: URLSearchParams, headers: Headers, bodyProvider: JsonProvider }): ApiRequest | undefined {
    const { instance, method, hostname, pathname, searchParams, headers, bodyProvider } = opts;
    const m = /^\/api\/1(\/[a-z\/-]+)$/.exec(pathname);
    if (!m) return undefined;
    const [ _, path ] = m;
    const m2 = /^bearer (.*?)$/i.exec(headers.get('authorization') ?? '');
    const bearerToken = m2 ? m2[1] : undefined;
    const rawIpAddress = computeRawIpAddress(headers);
    return { instance, method, hostname, path, searchParams, bearerToken, rawIpAddress, bodyProvider };
}

// deno-lint-ignore no-explicit-any
type JsonProvider = () => Promise<any>;

export async function computeApiResponse(request: ApiRequest, opts: { rpcClient: RpcClient, adminTokens: Set<string>, previewTokens: Set<string>, turnstileSecretKey: string | undefined }): Promise<Response> {
    const { instance, method, hostname, path, searchParams, bearerToken, rawIpAddress, bodyProvider } = request;
    const { rpcClient, adminTokens, previewTokens, turnstileSecretKey } = opts;

    try {
        // first, we need to know who's calling
        const identity = await computeIdentityResult(bearerToken, searchParams, adminTokens, previewTokens, rpcClient);
        console.log(`computeApiResponse`, { method, path, identity });
    
        // all api endpoints require an auth token
        if (identity.kind === 'invalid' && identity.reason === 'missing-token') return newJsonResponse({ error: 'unauthorized' }, 401);
    
        // invalid token or any other invalid reason
        if (identity.kind === 'invalid') return newJsonResponse({ error: 'forbidden' }, 403);

        if (path.startsWith('/admin/')) {
            // admin endpoints require admin
            if (!identity.permissions.has('admin')) return newJsonResponse({ error: 'forbidden' }, 403);

            if (path === '/admin/data') return await computeAdminDataResponse(method, bodyProvider, rpcClient);
            if (path === '/admin/rebuild-index') return await computeAdminRebuildResponse(method, bodyProvider, rpcClient);
            if (path === '/admin/metrics') return await computeAdminGetMetricsResponse(method, rpcClient);
        } else {
            if (path === '/redirect-logs') return await computeQueryRedirectLogsResponse(method, searchParams, rpcClient);
            if (path === '/api-keys') return await computeApiKeysResponse(instance, method, hostname, bodyProvider, rawIpAddress, turnstileSecretKey, rpcClient);
        }
        
        // unknown api endpoint
        return newJsonResponse({ error: 'not found' }, 404);
    } catch (e) {
        const error = `${e.stack || e}`;
        consoleError('api-call', `Error in api call: ${error}`);
        return newJsonResponse({ error }, 500);
    }
}

export interface ApiRequest {
    readonly instance: string;
    readonly method: string;
    readonly hostname: string;
    readonly path: string;
    readonly searchParams: URLSearchParams;
    readonly bearerToken?: string;
    readonly rawIpAddress?: string;
    readonly bodyProvider: JsonProvider;
}

//

type IdentityResult = ValidIdentityResult | InvalidIdentityResult;

interface ValidIdentityResult {
    readonly kind: 'valid';
    readonly permissions: ReadonlySet<ApiTokenPermission>;
}

interface InvalidIdentityResult {
    readonly kind: 'invalid';
    readonly reason: 'missing-token' | 'invalid-token';
}

//

async function computeIdentityResult(bearerToken: string | undefined, searchParams: URLSearchParams, adminTokens: Set<string>, previewTokens: Set<string>, rpcClient: RpcClient): Promise<IdentityResult> {
    const token = typeof bearerToken === 'string' ? bearerToken : searchParams.get('token') ?? undefined;
    if (token === undefined) return { kind: 'invalid', reason: 'missing-token' };
    if (adminTokens.has(token)) return { kind: 'valid', permissions: new Set([ 'admin' ]) };
    if (previewTokens.has(token)) return { kind: 'valid', permissions: new Set([ 'preview' ]) };
    const res = await rpcClient.resolveApiToken({ token }, 'api-auth-server');
    if (res.permissions !== undefined) return { kind: 'valid', permissions: new Set(res.permissions) };
    return { kind: 'invalid', reason: 'invalid-token' };
}

async function computeAdminDataResponse(method: string, bodyProvider: JsonProvider, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);

    const { operationKind, targetPath, dryRun } = await bodyProvider();

    if (operationKind === 'list' && targetPath === '/registry') {
        const { listResults } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, dryRun }, 'registry');
        return newJsonResponse({ listResults });
    } else if (operationKind === 'list' && targetPath === '/keys') {
        const { listResults } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, dryRun }, 'key-server');
        return newJsonResponse({ listResults });
    } else if (operationKind === 'list' && targetPath.startsWith('/crl/')) {
        const { listResults } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, dryRun }, 'combined-redirect-log');
        return newJsonResponse({ listResults });
    } else if (operationKind === 'list' && targetPath === '/crl/records') {
        const { listResults } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, dryRun }, 'combined-redirect-log');
        return newJsonResponse({ listResults });
    } else if (operationKind === 'delete' && targetPath.startsWith('/durable-object/')) {
        const doName = checkDeleteDurableObjectAllowed(targetPath);
        const { message } = await rpcClient.adminExecuteDataQuery({ operationKind, targetPath, dryRun }, doName);
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
    return await rpcClient.adminGetMetrics({}, 'combined-redirect-log');
}

async function computeApiKeysResponse(instance: string, method: string, hostname: string, bodyProvider: JsonProvider, rawIpAddress: string | undefined, turnstileSecretKey: string | undefined, rpcClient: RpcClient): Promise<Response> {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);
    if (typeof rawIpAddress !== 'string') throw new Error('Expected rawIpAddress string');
    if (instance !== 'local' && typeof turnstileSecretKey !== 'string') throw new Error('Expected turnstileSecretKey string');
    const requestBody = await bodyProvider();
    if (typeof requestBody !== 'object') throw new Error(`Expected object`);
    const { turnstileToken, apiKey: apiKeyFromInput } = requestBody;
    if (typeof turnstileToken !== 'string') throw new Error(`Expected turnstileToken string`);
    if (apiKeyFromInput !== undefined && typeof apiKeyFromInput !== 'string') throw new Error(`Expected apiKeyFromInput string`);
    if (apiKeyFromInput !== undefined && !isValidUuid(apiKeyFromInput)) throw new Error(`Bad apiKeyFromInput`);
    console.log(JSON.stringify({ turnstileToken, apiKeyFromInput}));

    if (typeof turnstileSecretKey === 'string') { // everywhere except instance = local
        // validate the turnstile token
        const formData = new FormData();
        formData.append('secret', turnstileSecretKey);
        formData.append('response', turnstileToken);
        formData.append('remoteip', rawIpAddress);

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData } );
        if (res.status !== 200) throw new Error(`Unexpected status ${res.status}`);
        const obj = await res.json();
        console.log(JSON.stringify(obj, undefined, 2));
        const { success, hostname: responseHostname, challenge_ts, action } = obj;
        if (typeof success !== 'boolean' || typeof responseHostname !== 'string' || typeof challenge_ts !== 'string' || typeof action !== 'string') throw new Error(`Unexpected validation response`);
        if (responseHostname !== hostname) throw new Error(`Unexpected responseHostname`);
        if (action !== 'api-key') throw new Error(`Unexpected action`);
        const age = Date.now() - new Date(challenge_ts).getTime();
        console.log({ age });
        if (age > 30000) throw new Error(`Challenge age too old`);
        if (!success) throw new Error(`Validation failed`);
    }

    // looks good, generate or lookup an api key
    const res = apiKeyFromInput ? await rpcClient.getApiKey({ apiKey: apiKeyFromInput }, 'api-key-server') : await rpcClient.generateNewApiKey({ }, 'api-key-server');
    const { info: { apiKey, status, created, used, permissions, name, token } } = res;

    return newJsonResponse({ apiKey, status, created, used, permissions, name, token });
}
