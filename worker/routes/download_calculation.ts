import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const downloadCalculationHtm = await importText(import.meta.url, '../static/download_calculation.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computeDownloadCalculationResponse(opts: { instance: string, origin: string, hostname: string, productionOrigin: string, cfAnalyticsToken: string | undefined }): Response {
    const { instance, origin, hostname, productionOrigin, cfAnalyticsToken } = opts;

    const html = computeHtml(downloadCalculationHtm, {
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
