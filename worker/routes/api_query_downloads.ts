import { Blobs } from '../backend/blobs.ts';
import { computeQueryDownloadsResponse } from '../backend/query_downloads.ts';
import { check, checkMatches } from '../check.ts';
import { isValidSha256Hex } from '../crypto.ts';
import { DoNames } from '../do_names.ts';
import { packError } from '../errors.ts';
import { newForbiddenJsonResponse, newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { ApiTokenPermission, hasPermission, QueryDownloadsRequest, RpcClient } from '../rpc_model.ts';
import { isValidUuid } from '../uuid.ts';
import { QUERY_DOWNLOADS } from './api_contract.ts';
import { computeApiQueryCommonParameters } from './api_query_common.ts';

export async function computeApiQueryDownloadsResponse(permissions: ReadonlySet<ApiTokenPermission>, method: string, path: string, searchParams: URLSearchParams, { statsBlobs, roStatsBlobs, rpcClient, colo }: { statsBlobs?: Blobs, roStatsBlobs?: Blobs, rpcClient: RpcClient, colo?: string }): Promise<Response> {
    if (!hasPermission(permissions, 'preview', 'read-data')) return newForbiddenJsonResponse();
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    let req: QueryDownloadsRequest;
    try {
        req = parseRequest(path, searchParams);
    } catch (e) {
        const { message } = packError(e);
        return newJsonResponse({ message }, 400);
    }
    if (searchParams.get('backend') === 'none') {
        const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
        if (!targetStatsBlobs) return newJsonResponse({ message: 'statsBlobs is required' }, 500);
        return await computeQueryDownloadsResponse(req, { statsBlobs: targetStatsBlobs });
    }
    if (colo === undefined) throw new Error('Need colo!');
    const target = DoNames.storagelessForSuffix(`downloads-${colo.toLowerCase()}`);
    return await rpcClient.queryDownloads(req, target);
}

//

function parseRequest(path: string, searchParams: URLSearchParams): QueryDownloadsRequest {
    const m = /^\/downloads\/show\/(.*?)$/.exec(path);
    if (!m) throw new Error(`Bad api path: ${path}`);
    
    const [ _, showUuid ] = m;
    check('showUuid', showUuid, isValidUuid);

    let request: QueryDownloadsRequest = {  kind: 'query-downloads', showUuid, ...computeApiQueryCommonParameters(searchParams, QUERY_DOWNLOADS) };
    const { bots, episodeId } = Object.fromEntries(searchParams);
    if (typeof bots === 'string') {
        checkMatches('bots', bots, /^(include|exclude)$/);
        request = { ...request, bots: bots as 'include' | 'exclude' };
    }
    if (typeof episodeId === 'string') {
        check('episodeId', episodeId, isValidSha256Hex);
        request = { ...request, episodeId };
    }
    if (searchParams.has('ro')) {
        request = { ...request, ro: true };
    }
    return request;
}
