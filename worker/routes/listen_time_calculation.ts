import { encodeXml, importText } from '../deps.ts';
import { KNOWN_APP_LINKS } from './api_shows.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const listenTimeCalculationHtm = await importText(import.meta.url, '../static/listen_time_calculation.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computeListenTimeCalculationResponse(opts: { instance: string, origin: string, hostname: string, productionOrigin: string, cfAnalyticsToken: string | undefined }): Response {
    const { instance, origin, hostname, productionOrigin, cfAnalyticsToken } = opts;

    const htm = listenTimeCalculationHtm.replace('<ul id="apps-list">', `<ul id="apps-list">\n${Object.entries(KNOWN_APP_LINKS).map(([ app, link ]) => `            <li><a href="${link}">${encodeXml(app)}</a></li>`).join('\n')}`)
    const html = computeHtml(htm, {
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
