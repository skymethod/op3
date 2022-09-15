import { importText } from '../deps.ts';
import { computeHtml } from './html.ts';

const termsHtm = await importText(import.meta.url, '../static/terms.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computeTermsResponse(opts: { instance: string }): Response {
    const { instance } = opts;

    const html = computeHtml(termsHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
