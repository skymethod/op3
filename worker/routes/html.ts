import { importText } from '../deps.ts';
import { TranslatedStrings, processTemplate, supportedLanguageLabels } from './strings.ts';

const outputCss = await importText(import.meta.url, '../static/output.css');
const shoelaceCommonHtm = await importText(import.meta.url, '../static/shoelace_common.htm');
const languageSelectionCommonHtm = await importText(import.meta.url, '../static/language_selection_common.htm');

export function computeStyleTag(): string {
    return `<style>\n${outputCss}\n    </style>`;
}

export function computeShoelaceCommon(...components: string[]): string {
    return computeHtml(shoelaceCommonHtm, { components: components.map(v => `'${v}'`).join(', ') });
}

export function computeLanguageSelection(contentLanguage: string): string {
    const shoelaceCommon = computeShoelaceCommon('sl-dropdown', 'sl-menu', 'sl-menu-item', 'sl-icon');
    return computeHtml(languageSelectionCommonHtm, {
        langLabelCurrent: supportedLanguageLabels[contentLanguage],
        langLabelEn: supportedLanguageLabels['en'],
        langLabelEs: supportedLanguageLabels['es'],
        langLabelFr: supportedLanguageLabels['fr'],
        langLabelNl: supportedLanguageLabels['nl'],
        shoelaceCommon,
        contentLanguage,
    });
}

export function computeHtml(template: string, variables: Record<string, string | boolean>, translatedStrings?: TranslatedStrings, lang?: string) {

    template = template.replace(/\${if (\w+)}(.*?)\${endif}/gs, (_, g1, g2) => {
        const value = variables[g1];
        if (value === undefined) throw new Error(`Undefined variable: ${g1}`);
        if (typeof value !== 'boolean') throw new Error(`Expected boolean condition: ${g1}`);
        return value ? g2 : '';
    });

    return processTemplate(template, variables, translatedStrings, lang).replaced;
}

export function removeHeader(html: string) {
    return html.replace(/<header.*?<\/header>/s, '');
}

export function computeCloudflareAnalyticsSnippet(cfAnalyticsToken: string | undefined) {
    return cfAnalyticsToken ? `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${cfAnalyticsToken}"}'></script><!-- End Cloudflare Web Analytics -->` : '';
}
