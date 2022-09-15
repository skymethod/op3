import { importText } from '../deps.ts';
import { computeHtml } from './html.ts';

const privacyHtm = await importText(import.meta.url, '../static/privacy.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computePrivacyResponse(opts: { instance: string }): Response {
    const { instance } = opts;

    const html = computeHtml(privacyHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
