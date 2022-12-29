import { importText } from '../deps.ts';
import { computeSessionToken } from '../session_token.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml, computeShoelaceCommon, computeStyleTag } from './html.ts';
import { computeNonProdHeader } from './instances.ts';

const setupHtm = await importText(import.meta.url, '../static/setup.htm');
const setupJs = await importText(import.meta.url, '../static/setup.js');

export async function computeSetupResponse(opts: { instance: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined, podcastIndexCredentials: string | undefined, previewTokens: Set<string> }): Promise<Response> {
    const { instance, origin, productionOrigin, cfAnalyticsToken, podcastIndexCredentials, previewTokens } = opts;

    const sessionToken = podcastIndexCredentials ? await computeSessionToken({ k: 's', t: new Date().toISOString() }, podcastIndexCredentials) : '';

    const html = computeHtml(setupHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: computeStyleTag(),
        shoelaceCommon: computeShoelaceCommon('sl-button', 'sl-input', 'sl-icon', 'sl-spinner', 'sl-button-group', 'sl-details', 'sl-alert'),
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        origin,
        setupJs,
        previewToken: [...previewTokens].at(0) ?? '',
        sessionToken,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
