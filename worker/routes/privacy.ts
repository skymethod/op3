import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const privacyHtm = await importText(import.meta.url, '../static/privacy.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computePrivacyResponse(opts: { instance: string, productionOrigin: string, cfAnalyticsToken: string | undefined }): Response {
    const { instance, productionOrigin, cfAnalyticsToken } = opts;

    const html = computeHtml(privacyHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        productionOrigin,
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnipped: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
