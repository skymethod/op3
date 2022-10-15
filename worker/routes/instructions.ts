import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml, computeShoelaceCommon, computeStyleTag } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const instructionsHtm = await importText(import.meta.url, '../static/instructions.htm');
const instructionsJs = await importText(import.meta.url, '../static/instructions.js');

export function computeInstructionsResponse(opts: { instance: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined, previewTokens: Set<string> }): Response {
    const { instance, origin, productionOrigin, cfAnalyticsToken, previewTokens } = opts;

    const html = computeHtml(instructionsHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: computeStyleTag(),
        shoelaceCommon: computeShoelaceCommon(),
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        origin,
        instructionsJs,
        previewToken: [...previewTokens].at(0) ?? '',
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
