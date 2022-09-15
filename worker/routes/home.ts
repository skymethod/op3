import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';
import { computeVersionFooter } from './versions.ts';

const homeHtm = await importText(import.meta.url, '../static/home.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computeHomeResponse(opts: { instance: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined, deploySha: string | undefined, deployTime: string | undefined }): Response {
    const { instance, origin, productionOrigin, cfAnalyticsToken, deploySha, deployTime } = opts;
    const html = computeHtml(homeHtm, {
        instance,
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        origin,
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        versionFooter: computeVersionFooter(deploySha, deployTime),
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
