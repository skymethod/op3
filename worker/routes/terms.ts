import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const termsHtm = await importText(import.meta.url, '../static/terms.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computeTermsResponse(opts: { instance: string, hostname: string, productionOrigin: string, productionDomain: string | undefined, cfAnalyticsToken: string | undefined }): Response {
    const { instance, hostname, productionOrigin, productionDomain, cfAnalyticsToken } = opts;

    // production terms only apply to production domain and any subdomains
    const applyTerms = typeof productionDomain === 'string' && (hostname === productionDomain || hostname.endsWith(`.${productionDomain}`));
    const html = computeHtml(termsHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        productionOrigin, 
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        applyTerms,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
