import { checkDeleteDurableObjectAllowed } from './admin_api.ts';
import { QueryRedirectLogsRequest, RpcClient, Unkinded } from '../rpc_model.ts';
import { check, checkMatches, isNotBlank, isValidHttpUrl, isValidInstant, tryParseInt } from '../check.ts';
import { packError } from '../errors.ts';
import { Bytes } from '../deps.ts';
import { isValidSha256Hex } from '../crypto.ts';
import { isValidUuid } from '../uuid.ts';

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

export async function computeApiResponse(request: ApiRequest, opts: { rpcClient: RpcClient, adminTokens: Set<string> }): Promise<Response> {
    const { method, path, searchParams, bearerToken, bodyProvider } = request;
    const { rpcClient, adminTokens } = opts;

    const identity = computeIdentity(bearerToken, searchParams, adminTokens);
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
        } else {
            if (path === '/redirect-logs') return await computeQueryRedirectLogsResponse(method, searchParams, rpcClient);
        }
    } catch (e) {
        const error = `${e.stack || e}`;
        console.error(`Error in api call: ${error}`);
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

function computeIdentity(bearerToken: string | undefined, searchParams: URLSearchParams, adminTokens: Set<string>): Identity | undefined {
    const token = typeof bearerToken === 'string' ? bearerToken : searchParams.get('token') ?? undefined;
    if (token === undefined) return undefined;
    if (adminTokens.has(token)) return 'admin';
    if (token === 'preview20f4') return 'preview';
    return 'invalid';
}

function newJsonResponse(obj: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(obj, undefined, 2), { status, headers: { 'content-type': 'application/json' } });
}

function newMethodNotAllowedResponse(method: string): Response {
    return new Response(`${method} not allowed`, { status: 405 });
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

async function computeQueryRedirectLogsResponse(method: string, searchParams: URLSearchParams, rpcClient: RpcClient) {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    let request: Unkinded<QueryRedirectLogsRequest> = { limit: 100 };

    try {
        const { start, startAfter, end, limit, url, urlSha256, userAgent, referer, edgeColo, ulid, format, method, uuid } = Object.fromEntries(searchParams);

        if (typeof start === 'string' && typeof startAfter === 'string') throw new Error(`Specify either 'start' or 'startAfter', not both`);
        if (typeof start === 'string') {
            check('start', start, isValidInstant);
            request = { ...request, startTimeInclusive: start };
        }
        if (typeof startAfter === 'string') {
            check('startAfter', startAfter, isValidInstant);
            request = { ...request, startTimeExclusive: startAfter };
        }
        if (typeof end === 'string') {
            check('end', end, isValidInstant);
            request = { ...request, endTimeExclusive: end };
        }
        if (typeof limit === 'string') {
            const lim = tryParseInt(limit);
            if (lim === undefined || lim < 0 || lim > 1000) throw new Error(`Bad limit: ${limit}`);
            request = { ...request, limit: lim };
        }
        if (typeof url === 'string' && typeof urlSha256 === 'string') throw new Error(`Specify either 'url' or 'urlSha256', not both`);
        if (typeof url === 'string') {
            check('url', url, isValidHttpUrl);
            const urlSha256 = (await Bytes.ofUtf8(url).sha256()).hex();
            request = { ...request, urlSha256 };
        }
        if (typeof urlSha256 === 'string') {
            check('urlSha256', urlSha256, isValidSha256Hex);
            request = { ...request, urlSha256 };
        }
        if (typeof userAgent === 'string') {
            check('userAgent', userAgent, isNotBlank);
            request = { ...request, userAgent };
        }
        if (typeof referer === 'string') {
            check('referer', referer, isNotBlank);
            request = { ...request, referer };
        }
        if (typeof edgeColo === 'string') {
            check('edgeColo', edgeColo, isNotBlank);
            request = { ...request, edgeColo };
        }
        if (typeof ulid === 'string') {
            check('ulid', ulid, isNotBlank);
            request = { ...request, ulid };
        }
        if (typeof method === 'string') {
            checkMatches('method', method, /^(NONGET|HEAD|PUT|PATCH|POST|DELETE|OPTIONS)$/);
            request = { ...request, method };
        }
        if (typeof format === 'string') {
            checkMatches('format', format, /^(tsv|json|json-o|json-a)$/);
            request = { ...request, format };
        }
        if (typeof uuid === 'string') {
            check('uuid', uuid, isValidUuid);
            request = { ...request, uuid };
        }
    } catch (e) {
        const { message } = packError(e);
        return newJsonResponse({ message }, 400);
    }
    return await rpcClient.queryRedirectLogs(request, 'combined-redirect-log');
}
