import { importText } from '../deps.ts';
import { computeHtml, removeHeader } from './html.ts';
import { computeNonProdWarning } from './instances.ts';

const privacyHtm = await importText(import.meta.url, '../static/privacy.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computePrivacyResponse(opts: { instance: string, origin: string, productionDomain?: string }): Response {
    const { instance, origin, productionDomain } = opts;

    const nonProdWarning = computeNonProdWarning(instance);
    
    let html = computeHtml(privacyHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        productionOrigin: productionDomain ? `https://${productionDomain}` : origin,
        nonProdWarning: nonProdWarning ?? '',
    });
    if (!nonProdWarning) html = removeHeader(html);

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
