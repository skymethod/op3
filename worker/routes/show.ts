import { timed } from '../async.ts';
import { Blobs } from '../backend/blobs.ts';
import { importText, setIntersect } from '../deps.ts';
import { RpcClient } from '../rpc_model.ts';
import { computeSessionToken } from '../session_token.ts';
import { isValidUuid } from '../uuid.ts';
import { compute404Response } from './404.ts';
import { computeIdentityResult, identityResultToJson } from './api.ts';
import { computeShowsResponse, computeShowStatsResponse } from './api_shows.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml, computeShoelaceCommon, computeStyleTag } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const showHtm = await importText(import.meta.url, '../static/show.htm');
const showJs = await importText(import.meta.url, '../static/show.js');

export type ShowRequest = { showUuid: string };

export function tryParseShowRequest({ method, pathname }: { method: string, pathname: string }): ShowRequest | undefined {
    const m = /^\/show\/([0-9a-f]{32})$/.exec(pathname);
    return method === 'GET' && m ? { showUuid: m[1] } : undefined;
}

export async function computeShowResponse(req: ShowRequest, opts: { searchParams: URLSearchParams, instance: string, hostname: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined, podcastIndexCredentials: string | undefined, adminTokens: Set<string>, previewTokens: Set<string>, rpcClient: RpcClient, roRpcClient: RpcClient | undefined, statsBlobs: Blobs | undefined, roStatsBlobs: Blobs | undefined }): Promise<Response> {
    const { searchParams, instance, hostname, origin, productionOrigin, cfAnalyticsToken, podcastIndexCredentials, adminTokens, previewTokens, rpcClient, roRpcClient, statsBlobs, roStatsBlobs } = opts;
    const { showUuid } = req;

    const start = Date.now();

    const compute404 = (reason: string) => {
        console.log(`Returning 404: ${reason}`);
        return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    }

    if (!isValidUuid(showUuid)) return compute404(`Invalid showUuid: ${showUuid}`);
    const times: Record<string, number> = {};
    const result = await timed(times, 'compute-identity-result', () => computeIdentityResult({ bearerToken: undefined, searchParams, adminTokens, previewTokens, rpcClient }));
    if (result.kind !== 'valid') return compute404(`Invalid id result: ${JSON.stringify(identityResultToJson(result))}`);

    const allowed = result.permissions.has('admin') || result.permissions.has('read-show') && setIntersect(result.shows, new Set([ showUuid, '00000000000000000000000000000000' ])).size > 0;
    if (!allowed) return compute404(`Not allowed: ${JSON.stringify(identityResultToJson(result))}`);

    const sessionToken = podcastIndexCredentials ? await timed(times, 'compute-session-token', () => computeSessionToken({ k: 's', t: new Date().toISOString() }, podcastIndexCredentials)) : '';

    const [ showRes, statsRes ] = await timed(times, 'compute-shows+compute-stats', () => Promise.all([
        computeShowsResponse({ method: 'GET', searchParams, showUuid, rpcClient, roRpcClient, times }),
        computeShowStatsResponse({ showUuid, method: 'GET', searchParams, statsBlobs, roStatsBlobs, times }),
    ]));
    if (showRes.status !== 200) return compute404(`Unexpected show response status: ${JSON.stringify(showRes.status)}`);
    const showObj = await showRes.json();
    const { title } = showObj;

    const showTitle = title ?? '<untitled>';
    if (statsRes.status !== 200) return compute404(`Unexpected stats response status: ${JSON.stringify(statsRes.status)}`);
    const statsObj = await statsRes.json();

    times.compute = Date.now() - start;

    const initialData = JSON.stringify({ showObj, statsObj, times });

    const html = computeHtml(showHtm, {
        showUuid,
        showTitle,
        initialData,
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: computeStyleTag(),
        shoelaceCommon: computeShoelaceCommon('sl-card', 'sl-spinner', 'sl-icon-button', 'sl-button-group', 'sl-button', 'sl-dropdown', 'sl-menu', 'sl-menu-item', 'sl-switch', 'sl-icon'),
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        origin,
        showJs,
        previewToken: [...previewTokens].at(0) ?? '',
        sessionToken,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
