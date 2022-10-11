import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const apiKeysHtm = await importText(import.meta.url, '../static/api_keys.htm');
const apiKeysJs = await importText(import.meta.url, '../static/api_keys.js');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computeApiKeysResponse(opts: { instance: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined, turnstileSitekey: string | undefined, previewTokens: Set<string> }): Response {
    const { instance, origin, productionOrigin, cfAnalyticsToken, turnstileSitekey, previewTokens } = opts;

    const html = computeHtml(apiKeysHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        origin,
        apiKeysJs,
        turnstileSitekey: turnstileSitekey ?? TestSitekeys.AlwaysPasses,
        previewToken: [...previewTokens].at(0) ?? '',
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}

//

enum TestSitekeys  {
    AlwaysPasses = '1x00000000000000000000AA',
    AlwaysBlocks = '2x00000000000000000000AB',
    ForceInteraction = '3x00000000000000000000FF',
}
