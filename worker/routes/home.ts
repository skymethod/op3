import { importText } from '../deps.ts';
import { computeHtml } from './html.ts';

const homeHtm = await importText(import.meta.url, '../static/home.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computeHomeResponse(opts: { instance: string, origin: string, productionDomain?: string }): Response {
    const { instance, origin, productionDomain } = opts;

    const html = computeHtml(homeHtm, {
        instance,
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        origin: productionDomain ? `https://${productionDomain}` : origin,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
