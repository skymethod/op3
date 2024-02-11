import { importText } from '../deps.ts';
import { computeStringArgs, replacePlaceholders } from './strings.ts';

const outputCss = await importText(import.meta.url, '../static/output.css');
const shoelaceCommonHtm = await importText(import.meta.url, '../static/shoelace_common.htm');

export function computeStyleTag(): string {
    return `<style>\n${outputCss}\n    </style>`;
}

export function computeShoelaceCommon(...components: string[]): string {
    return computeHtml(shoelaceCommonHtm, { components: components.map(v => `'${v}'`).join(', ') });
}

export function computeHtml(template: string, variables: Record<string, string | boolean>) {

    template = template.replace(/\${if (\w+)}(.*?)\${endif}/gs, (_, g1, g2) => {
        const value = variables[g1];
        if (value === undefined) throw new Error(`Undefined variable: ${g1}`);
        if (typeof value !== 'boolean') throw new Error(`Expected boolean condition: ${g1}`);
        return value ? g2 : '';
    });

    return template.replace(/(\/\*)?\${((\w+)|s:(\w+)((:\w+=\w+)*):"(.*?)")}(\*\/({})?)?/g, (_, _1, variableExpression, variableName, stringName, stringArgs, _6, stringValue) => {
        if (variableName !== undefined) {
            const value = variables[variableName];
            if (value === undefined) throw new Error(`Undefined variable: ${variableName}`);
            if (typeof value === 'boolean') return `${value}`;
            return value;
        } else if (stringName !== undefined && stringValue !== undefined) {
            const { nameValuePairs } = computeStringArgs(stringArgs);
            return replacePlaceholders(stringValue, nameValuePairs);
        } else {
            throw new Error(`Unsupported variable expression: ${variableExpression}`);
        }
    });
}

export function removeHeader(html: string) {
    return html.replace(/<header.*?<\/header>/s, '');
}

export function computeCloudflareAnalyticsSnippet(cfAnalyticsToken: string | undefined) {
    return cfAnalyticsToken ? `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${cfAnalyticsToken}"}'></script><!-- End Cloudflare Web Analytics -->` : '';
}
