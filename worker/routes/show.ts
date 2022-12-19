import { Blobs } from '../backend/blobs.ts';
import { importText } from '../deps.ts';
import { RpcClient } from '../rpc_model.ts';
import { computeSessionToken } from '../session_token.ts';
import { isValidUuid } from '../uuid.ts';
import { compute404Response } from './404.ts';
import { computeShowsResponse, computeShowStatsResponse } from './api_shows.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml, computeShoelaceCommon, computeStyleTag } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const showHtm = await importText(import.meta.url, '../static/show.htm');
const showJs = await importText(import.meta.url, '../static/show.js');

export type ShowRequest = { showUuid: string, ro?: boolean };

export function tryParseShowRequest({ method, pathname, searchParams, adminTokens }: { method: string, pathname: string, searchParams: URLSearchParams, adminTokens: Set<string> }): ShowRequest | undefined {
    const token = searchParams.get('token');
    if (!adminTokens.has(token ?? '')) return undefined;
    const m = /^\/show\/([0-9a-f]{32})$/.exec(pathname);
    return method === 'GET' && m ? { showUuid: m[1], ro: searchParams.has('ro') } : undefined;
}

export async function computeShowResponse(req: ShowRequest, opts: { instance: string, hostname: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined, podcastIndexCredentials: string | undefined, previewTokens: Set<string>, rpcClient: RpcClient, roRpcClient: RpcClient | undefined, statsBlobs: Blobs | undefined, roStatsBlobs: Blobs | undefined }): Promise<Response> {
    const { instance, hostname, origin, productionOrigin, cfAnalyticsToken, podcastIndexCredentials, previewTokens, rpcClient, roRpcClient, statsBlobs, roStatsBlobs } = opts;
    const { showUuid, ro } = req;

    if (!isValidUuid(showUuid)) return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });

    const sessionToken = podcastIndexCredentials ? await computeSessionToken({ k: 's', t: new Date().toISOString() }, podcastIndexCredentials) : '';

    const searchParams = new URLSearchParams(ro ? { ro: '1' } : {});
    const showsRes = await computeShowsResponse({ method: 'GET', searchParams, showUuid, rpcClient, roRpcClient });
    if (showsRes.status === 404) return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    if (showsRes.status !== 200) throw new Error(`Unexpected api response: ${showsRes.status}`);
    const { title } = await showsRes.json();

    const showTitle = title ?? '<untitled>';

    const statsRes = await computeShowStatsResponse({ showUuid, method: 'GET', searchParams, statsBlobs, roStatsBlobs });
    if (statsRes.status === 404) return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    if (statsRes.status !== 200) throw new Error(`Unexpected api response: ${statsRes.status}`);
    const { hourlyDownloads } = await statsRes.json();


    const html = computeHtml(showHtm, {
        showUuid,
        showTitle,
        hourlyDownloads: JSON.stringify(hourlyDownloads),
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: computeStyleTag(),
        shoelaceCommon: computeShoelaceCommon('sl-button', 'sl-icon', 'sl-spinner'),
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        origin,
        showJs,
        previewToken: [...previewTokens].at(0) ?? '',
        sessionToken,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
