import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';
import { Translations } from './strings.ts';

const downloadCalculationHtm = await importText(import.meta.url, '../static/download_calculation.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');
const downloadCalculationPageTranslationsJson = await importText(import.meta.url, '../strings/download_calculation_page.translations.json');
const translations = new Translations(downloadCalculationPageTranslationsJson);

export function computeDownloadCalculationResponse(opts: { instance: string, origin: string, hostname: string, productionOrigin: string, cfAnalyticsToken: string | undefined, acceptLanguage: string | undefined, searchParams: URLSearchParams }): Response {
    const { instance, origin, hostname, productionOrigin, cfAnalyticsToken, acceptLanguage, searchParams } = opts;

    const { lang, contentLanguage, translatedStrings } = translations.compute({ searchParams, acceptLanguage });

    const html = computeHtml(downloadCalculationHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        productionOrigin,
        origin,
        hostname,
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        contentLanguage,
    }, translatedStrings, lang);

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-language': contentLanguage } });
}
