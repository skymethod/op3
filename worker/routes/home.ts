import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const homeHtm = await importText(import.meta.url, '../static/home.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computeHomeResponse(opts: { instance: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined, deploySha: string | undefined, deployTime: string | undefined }): Response {
    const { instance, origin, productionOrigin, cfAnalyticsToken, deploySha = 'UNDEFINEDcf1262aUNDEFINED721b53UNDEFINED', deployTime = 'UNDEFINED7T11:22:33Z' } = opts;
    const html = computeHtml(homeHtm, {
        instance,
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        origin,
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        deploySha,
        deployTime,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
