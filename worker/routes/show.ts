import { timed } from '../async.ts';
import { Blobs } from '../backend/blobs.ts';
import { isString } from '../check.ts';
import { Configuration } from '../configuration.ts';
import { encodeXml, importText } from '../deps.ts';
import { DoNames } from '../do_names.ts';
import { RpcClient } from '../rpc_model.ts';
import { computeSessionToken } from '../session_token.ts';
import { isValidUuid } from '../uuid.ts';
import { compute404Response } from './404.ts';
import { computeShowsResponse, computeShowStatsResponse, DEMO_SHOW_1 } from './api_shows.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml, computeShoelaceCommon, computeStyleTag } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const showHtm = await importText(import.meta.url, '../static/show.htm');
const showJs = await importText(import.meta.url, '../static/show.js');

export type ShowRequest = { id: string, type: 'show-uuid' | 'podcast-guid' };

export function tryParseShowRequest({ method, pathname }: { method: string, pathname: string }): ShowRequest | undefined {
    const m = /^\/show\/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(pathname);
    if (!m) return undefined;
    const id = m[1].toLowerCase();
    const type = id.includes('-') ? 'podcast-guid' : 'show-uuid';
    return method === 'GET' && m ? { id, type } : undefined;
}

type Opts = {
    searchParams: URLSearchParams,
    instance: string,
    hostname: string,
    origin: string,
    productionOrigin: string,
    cfAnalyticsToken: string | undefined,
    podcastIndexCredentials: string | undefined,
    previewTokens: Set<string>, 
    rpcClient: RpcClient, 
    roRpcClient: RpcClient | undefined, 
    statsBlobs: Blobs | undefined, 
    roStatsBlobs: Blobs | undefined, 
    configuration: Configuration,
    assetBlobs: Blobs | undefined, 
    roAssetBlobs: Blobs | undefined, 
};

export async function computeShowResponse(req: ShowRequest, opts: Opts): Promise<Response> {
    const { searchParams, instance, hostname, origin, productionOrigin, cfAnalyticsToken, podcastIndexCredentials, previewTokens, rpcClient, roRpcClient, statsBlobs, roStatsBlobs, configuration, assetBlobs, roAssetBlobs } = opts;
    const { id, type } = req;

    const start = Date.now();

    const compute404 = (reason: string) => {
        console.log(`Returning 404: ${reason}`);
        return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    }

    let showUuidFromPodcastGuid: string | undefined;
    if (type === 'podcast-guid') {
        showUuidFromPodcastGuid = await lookupShowUuid({ podcastGuid: id, rpcClient, roRpcClient , searchParams });
        if (!showUuidFromPodcastGuid) return compute404(`Unknown podcastGuid: ${id}`);
    }
    const showUuid = showUuidFromPodcastGuid ?? id;
    if (!isValidUuid(showUuid)) return compute404(`Invalid showUuid: ${showUuid}`);

    const times: Record<string, number> = {};
    
    const sessionToken = podcastIndexCredentials ? await timed(times, 'compute-session-token', () => computeSessionToken({ k: 's', t: new Date().toISOString() }, podcastIndexCredentials)) : '';

    const [ showRes, statsRes, ogImageRes ] = await timed(times, 'compute-shows+compute-stats+head-og-image', () => Promise.all([
        computeShowsResponse({ method: 'GET', searchParams, showUuid, rpcClient, roRpcClient, times, configuration }),
        computeShowStatsResponse({ showUuid, method: 'GET', searchParams, statsBlobs, roStatsBlobs, times, configuration }),
        headOgImage({ showUuid, searchParams, assetBlobs, roAssetBlobs }),
    ]));
    if (showRes.status !== 200) return compute404(`Unexpected show response status: ${JSON.stringify(showRes.status)}`);
    const showObj = await showRes.json();
    const { title } = showObj;

    const showTitle = title ?? '(untitled)';
    if (statsRes.status !== 200) return compute404(`Unexpected stats response status: ${JSON.stringify(statsRes.status)}`);
    const statsObj = await statsRes.json();

    times.compute = Date.now() - start;

    const initialData = JSON.stringify({ showObj, statsObj, times });
    const showTitleWithSuffix = `${showTitle} · OP3${instance === 'prod' ? '' : ` (${instance})`}: The Open Podcast Prefix Project`;

    const html = computeHtml(showHtm, {
        showUuid,
        showTitle,
        showTitleWithSuffix,
        ogTags: computeOgTags({ ogImageRes, showTitleWithSuffix, showUuid, origin, searchParams, showTitle }),
        initialData,
        styleTag: computeStyleTag(),
        shoelaceCommon: computeShoelaceCommon('sl-card', 'sl-spinner', 'sl-icon-button', 'sl-button-group', 'sl-button', 'sl-dropdown', 'sl-menu', 'sl-menu-item', 'sl-switch', 'sl-icon', 'sl-relative-time'),
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        origin,
        showJs,
        previewToken: [...previewTokens].at(0) ?? '',
        sessionToken,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}

export type ShowOgImageRequest = { showUuid: string };

export function tryParseShowOgImageRequest({ method, pathname }: { method: string, pathname: string }): ShowOgImageRequest | undefined {
    const m = /^\/show\/([0-9a-f]{32})\/og-.*?\.png$/.exec(pathname);
    return method === 'GET' && m ? { showUuid: m[1] } : undefined;
}

export async function computeShowOgImageResponse(req: ShowOgImageRequest, opts: Opts): Promise<Response> {
    const { showUuid } = req;
    const { searchParams, roAssetBlobs, assetBlobs, instance, origin, hostname, productionOrigin, cfAnalyticsToken } = opts;

    const compute404 = (reason: string) => {
        console.log(`Returning 404: ${reason}`);
        return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    }

    if (!isValidUuid(showUuid)) return compute404(`Invalid showUuid: ${showUuid}`);

    const targetAssetBlobs = searchParams.has('ro') ? roAssetBlobs : assetBlobs;
    if (!targetAssetBlobs) return compute404('No asset blobs');

    const { stream, etag } = await targetAssetBlobs.get(computeOgImageKey({ showUuid }), 'stream-and-meta') ?? {};
    if (!stream || !etag) return compute404(`OG image not found for show ${showUuid}`);
    return new Response(stream, { headers: { 'content-type': 'image/png', etag }});
}

export function computeOgImageKey({ showUuid }: { showUuid: string}): string {
    return `show/${showUuid}/og.png`;
}

export function computeDemoShowResponse({ origin }: { origin: string }): Response {
    return new Response(undefined, {
        status: 302,
        headers: {
            'cache-control': 'private, no-cache',
            'location': `${origin}/show/${DEMO_SHOW_1}`,
        }
    });
}

//

async function lookupShowUuid({ podcastGuid, rpcClient, roRpcClient, searchParams }: { podcastGuid: string, rpcClient: RpcClient, roRpcClient: RpcClient | undefined, searchParams: URLSearchParams }): Promise<string | undefined> {
    const targetRpcClient = searchParams.has('ro') ? roRpcClient : rpcClient;
    if (!targetRpcClient) throw new Error(`Need rpcClient`);

    const { results = [] } = await targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: '/show/show-uuids', parameters: { podcastGuid } }, DoNames.showServer);
    return results.filter(isString).filter(isValidUuid).at(0);
}

async function headOgImage({ showUuid, searchParams, assetBlobs, roAssetBlobs }: { showUuid: string, searchParams: URLSearchParams, assetBlobs: Blobs | undefined, roAssetBlobs: Blobs | undefined }): Promise<{ etag: string } | undefined> {
    const targetAssetBlobs = searchParams.has('ro') ? roAssetBlobs : assetBlobs;
    return await targetAssetBlobs?.head(computeOgImageKey({ showUuid }));
}

function computeOgTags({ ogImageRes, showTitle, showTitleWithSuffix, showUuid, origin, searchParams }: { ogImageRes: { etag: string } | undefined, showTitle: string, showTitleWithSuffix: string, showUuid: string, origin: string, searchParams: URLSearchParams }): string {
    const { etag } = ogImageRes ?? {};
    return [
        `<meta property="og:title" content="${encodeXml(showTitleWithSuffix)}" />`,
        `<meta property="og:description" content="Podcast statistics for ${encodeXml(showTitle)}, measured by OP3" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:url" content="${origin}/show/${showUuid}" />`,
        ...(etag ? [ `<meta property="og:image" content="${computeOgImageUrl({ origin, showUuid, etag, searchParams })}" />`, '<meta name="twitter:card" content="summary_large_image" />' ] : []),
    ].join('\n    ');
}

function computeOgImageUrl({ origin, showUuid, etag, searchParams }: { origin: string, showUuid: string, etag: string, searchParams: URLSearchParams }) {
    const u = new URL(`${origin}/show/${showUuid}/og-${etag}.png`);
    for (const [ name, value ] of searchParams) {
        u.searchParams.append(name, value);
    }
    return u.toString();
}
