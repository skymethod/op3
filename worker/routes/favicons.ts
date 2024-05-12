import { importText } from '../deps.ts';

const faviconSvg = await importText(import.meta.url, '../static/favicon.svg');

export function computeFaviconSvgResponse(): Response {
    return new Response(faviconSvg, { headers: { 'content-type': 'image/svg+xml' }});
}
