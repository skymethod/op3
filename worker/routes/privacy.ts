import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const privacyHtm = await importText(import.meta.url, '../static/privacy.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computePrivacyResponse(opts: { instance: string, origin: string, hostname: string, productionOrigin: string, cfAnalyticsToken: string | undefined }): Response {
    const { instance, origin, hostname, productionOrigin, cfAnalyticsToken } = opts;

    const html = computeHtml(privacyHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        productionOrigin,
        origin,
        hostname,
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
