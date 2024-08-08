import { timed } from '../async.ts';
import { Blobs } from '../backend/blobs.ts';
import { Configuration } from '../configuration.ts';
import { encodeXml, importText } from '../deps.ts';
import { packError } from '../errors.ts';
import { Limiter } from '../limiter.ts';
import { SHOW_UUID_REDIRECTS } from '../redirects.ts';
import { newJsonResponse } from '../responses.ts';
import { RpcClient } from '../rpc_model.ts';
import { isValidUuid } from '../uuid.ts';
import { compute404Response } from './404.ts';
import { computeShowsResponse, computeShowStatsResponse, DEMO_SHOW_1, lookupShowUuidForPodcastGuid } from './api_shows.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml, computeShoelaceCommon, computeStyleTag } from './html.ts';
import { computeNonProdHeader } from './instances.ts';
import { appJs } from './static.ts';
import { Translations, supportedLanguageLabels } from './strings.ts';

const showHtm = await importText(import.meta.url, '../static/show.htm');

const showPageTranslationsJson = await importText(import.meta.url, '../strings/show_page.translations.json');
const translations = new Translations(showPageTranslationsJson);

export type ShowRequest = { id: string, type: 'show-uuid' | 'podcast-guid', acceptLanguage: string | undefined };

export function tryParseShowRequest({ method, pathname, acceptLanguage }: { method: string, pathname: string, acceptLanguage: string | undefined }): ShowRequest | undefined {
    const m = /^\/show\/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(pathname);
    if (!m) return undefined;
    const id = m[1].toLowerCase();
    const type = id.includes('-') ? 'podcast-guid' : 'show-uuid';
    return method === 'GET' && m ? { id, type, acceptLanguage } : undefined;
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
    limiter: Limiter | undefined,
    rawIpAddress: string | undefined,
};

export async function computeShowResponse(req: ShowRequest, opts: Opts): Promise<Response> {
    const { searchParams, instance, hostname, origin, productionOrigin, cfAnalyticsToken, previewTokens, rpcClient, roRpcClient, statsBlobs, roStatsBlobs, configuration, assetBlobs, roAssetBlobs, limiter, rawIpAddress } = opts;
    const { id, type, acceptLanguage } = req;

    const times: Record<string, number> = {};

    const compute404 = (reason: string) => {
        console.log(`Returning 404: ${reason}`);
        return compute404Response({ instance, origin, hostname, productionOrigin, cfAnalyticsToken });
    }

    let showUuidFromPodcastGuid: string | undefined;
    if (type === 'podcast-guid') {
        const { success } = limiter && rawIpAddress ? await limiter.isAllowed(`show:podcast-guid:ip:${rawIpAddress}`) : { success: true };
        if (!success) return new Response('slow down', { status: 429 });
        showUuidFromPodcastGuid = await timed(times, 'lookup-show-uuid', () => lookupShowUuidForPodcastGuid(id, { rpcClient, roRpcClient, searchParams, rawIpAddress }));
        if (!showUuidFromPodcastGuid) return compute404(`Unknown podcastGuid: ${id}`);
    }
    const showUuid = showUuidFromPodcastGuid ?? id;
    if (!isValidUuid(showUuid)) return compute404(`Invalid showUuid: ${showUuid}`);

    const redirectToShowUuid = SHOW_UUID_REDIRECTS[showUuid];
    if (redirectToShowUuid) {
        const u = new URL(`${origin}/show/${redirectToShowUuid}`);
        searchParams.forEach((v, n) => u.searchParams.append(n, v));
        const location = u.toString();
        return new Response(`👉 ${location}`, { status: 308, headers: { location } });
    }

    const tryLoadData = async () => {
        try {
            const cachedData = await timed(times, 'read-cached-data', () => configuration.getObj(`cached-show-data/${showUuid}`));
            if (cachedData) {
                return cachedData as LoadDataResult;
            }
            return await loadData({ searchParams, times, showUuid, rpcClient, roRpcClient, configuration, origin, statsBlobs, roStatsBlobs, assetBlobs, roAssetBlobs });
        } catch (e) {
            const { message } = packError(e);
            return newJsonResponse({ message }, 500);
        }
    };
    const loadDataResult = await timed(times, 'try-load-data', () => tryLoadData());
    if (loadDataResult instanceof Response) return loadDataResult;
    const { showObj, statsObj, ogImageRes } = loadDataResult;
    const { title } = showObj;
    const showTitle = title ?? '(untitled)';

    const { lang, contentLanguage, translatedStrings: showPageTranslations } = translations.compute({ searchParams, acceptLanguage });

    const initialData = JSON.stringify({ showObj, statsObj, times, showPageTranslations, lang });
    const showTitleWithSuffix = `${showTitle} · OP3${instance === 'prod' ? '' : ` (${instance})`}: The Open Podcast Prefix Project`;

    const html = computeHtml(showHtm, {
        showUuid,
        showTitle,
        showTitleWithSuffix,
        ogTags: computeOgTags({ ogImageRes, showTitleWithSuffix, showUuid, origin, searchParams, showTitle }),
        initialData,
        styleTag: computeStyleTag(),
        shoelaceCommon: computeShoelaceCommon('sl-card', 'sl-spinner', 'sl-icon-button', 'sl-button-group', 'sl-button', 'sl-dropdown', 'sl-menu', 'sl-menu-item', 'sl-switch', 'sl-icon', 'sl-relative-time', 'data-loaded'),
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        origin,
        appJs,
        previewToken: [...previewTokens].at(0) ?? '',
        contentLanguage,
        langLabelCurrent: supportedLanguageLabels[lang ?? 'en'],
        langLabelEn: supportedLanguageLabels['en'],
        langLabelEs: supportedLanguageLabels['es'],
        langLabelFr: supportedLanguageLabels['fr'],
        langLabelNl: supportedLanguageLabels['nl'],
        langLabelDe: supportedLanguageLabels['de'],
        langLabelEnGb: supportedLanguageLabels['en-gb'],
    }, showPageTranslations, lang);

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-language': contentLanguage } });
}

type LoadDataOpts = {
    searchParams: URLSearchParams,
    times: Record<string, number>,
    showUuid: string,
    rpcClient: RpcClient, 
    roRpcClient: RpcClient | undefined, 
    origin: string,
    configuration: Configuration,
    statsBlobs: Blobs | undefined, 
    roStatsBlobs: Blobs | undefined,
    assetBlobs: Blobs | undefined, 
    roAssetBlobs: Blobs | undefined, 
};

// deno-lint-ignore no-explicit-any
type LoadDataResult = { showObj: any, statsObj: any, ogImageRes?: { etag: string } };

export async function loadData({ searchParams, times, showUuid, rpcClient, roRpcClient, configuration, origin, statsBlobs, roStatsBlobs, assetBlobs, roAssetBlobs }: LoadDataOpts): Promise<LoadDataResult> {
    const showsSearchParams = new URLSearchParams(searchParams);
    showsSearchParams.set('episodes', 'include'); // required to load episodes
    const [ showRes, statsRes, ogImageRes ] = await timed(times, 'compute-shows+compute-stats+head-og-image', () => Promise.all([
        computeShowsResponse({ method: 'GET', searchParams: showsSearchParams, showUuidOrPodcastGuidOrFeedUrlBase64: showUuid, rpcClient, roRpcClient, times, configuration, origin }),
        computeShowStatsResponse({ showUuid, method: 'GET', searchParams, statsBlobs, roStatsBlobs, times, configuration }),
        headOgImage({ showUuid, searchParams, assetBlobs, roAssetBlobs }),
    ]));
    if (showRes.status !== 200) throw new Error(`Unexpected show response status: ${JSON.stringify(showRes.status)}`);
    if (statsRes.status !== 200) throw new Error(`Unexpected stats response status: ${JSON.stringify(statsRes.status)}`);

    const [ showObj, statsObj ] = await Promise.all([ showRes.json(), statsRes.json() ]);
    return { showObj, statsObj, ogImageRes };
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

export function computeDemoShowResponse({ origin, searchParams }: { origin: string, searchParams: URLSearchParams }): Response {
    const lang = searchParams.get('lang') ?? undefined;
    return new Response(undefined, {
        status: 302,
        headers: {
            'cache-control': 'private, no-cache',
            'location': `${origin}/show/${DEMO_SHOW_1}${lang ? `?lang=${lang}` : ''}`,
        }
    });
}

//

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
