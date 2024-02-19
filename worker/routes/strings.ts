export function replacePlaceholders(str: string, nameValuePairs: string | number | [string, string | number][]): string {
    const nvps = Array.isArray(nameValuePairs) ? nameValuePairs : [ [ 'arg', nameValuePairs ] ];
    let i = 0;
    return str.replace(/%[dDsS]/g, (sub) => {
        const nvp = nvps[i];
        i++;
        if (nvp === undefined) return sub; // soft fail in case we are deferring replacement to js
        return nvp[1].toString();
    });
}

export function computeStringArgs(args: unknown): { character_limit?: number, nameValuePairs: [ string, string ][] } {
    let character_limit: number | undefined;
    const nameValuePairs: [ string, string ][] = [];
    if (typeof args === 'string') {
        for (const nvp of args.split(':').filter(v => v !== '')) {
            const [ name, value ] = nvp.split('=');
            if (name === 'charlimit') {
                character_limit = parseInt(value);
            } else {
                nameValuePairs.push([ name, value ]);
            }
        }
    }
    return { character_limit, nameValuePairs };
} 

// https://help.transifex.com/en/articles/6220899-structured-json
export type StructuredValue = {
    /** Translatable string (Required). */
    string: string,
    /** Maximum number of characters the translation can have (Optional) */
    character_limit?: number,
    /** Small segment of text used to differentiate from entries with the same string value (Optional). */
    context?: string,
    /** Small description to give context to translators about how the string should be translated (Optional) */
    developer_comment?: string,
};
export type StructuredJsonStrings = Record<string, StructuredValue>;

export function processTemplate(template: string, variables: Record<string, string | boolean> | undefined, translatedStrings: TranslatedStrings | undefined, lang: string | undefined): { replaced: string, strings: StructuredJsonStrings } {
    const entries: [ string, StructuredValue ][] = [];
    const replaced = template.replace(/(\/\*)?\${((\w+)|s:(\w+)((:\w+=\w+)*):'(.*?)')}(\*\/({})?)?/g, (_, _1, variableExpression, variableName, stringName, stringArgs, _6, stringValue) => {
        if (variableName !== undefined) {
            if (variables === undefined) return '';
            const value = variables[variableName];
            if (value === undefined) throw new Error(`Undefined variable: ${variableName}`);
            if (typeof value === 'boolean') return `${value}`;
            return value;
        } else if (stringName !== undefined && stringValue !== undefined) {
            const { character_limit, nameValuePairs } = computeStringArgs(stringArgs);
            const existing = entries.find(v => v[0] === stringName);
            if (existing) {
                if (typeof character_limit === 'number' && character_limit !== existing[1].character_limit) throw new Error(`Cannot redefine charlimit: ${variableExpression}`);
                if (stringValue !== '' && stringValue !== existing[1].string) throw new Error(`Cannot redefine string: ${variableExpression}`);
                const translated = replaceWithTranslation(stringName, existing[1].string, translatedStrings, lang);
                return replacePlaceholders(translated, nameValuePairs);
            } else {
                entries.push([ stringName, { string: stringValue, character_limit } ]);
                const translated = replaceWithTranslation(stringName, stringValue, translatedStrings, lang);
                return replacePlaceholders(translated, nameValuePairs);
            }
        } else {
            throw new Error(`Unsupported variable expression: ${variableExpression}`);
        }
    });
    const strings = Object.fromEntries(entries);
    return { replaced, strings };
}

export type TranslatedStrings = Record<string /* stringName/key */, Record<string /* lang */, string /* translated value */>>;

export function replaceWithTranslation(stringName: string, stringValue: string, translatedStrings: TranslatedStrings | undefined, lang: string | undefined) {
    if (lang === undefined) return stringValue;
    if (lang === 'up') return stringValue.toUpperCase();
    if (translatedStrings === undefined) return stringValue;
    const translations = translatedStrings[stringName]; if (translations === undefined) return stringValue;
    return translations[lang] ?? stringValue;
}

export function pluralize(n: number, strings: Record<string, string>, singleKey: string, pluralKey: string, format?: Intl.NumberFormat): string {
    return replacePlaceholders(strings[n === 1 ? singleKey : pluralKey], (format ?? withCommas).format(n));
}

export function computePreferredSupportedLanguage({ langParam, acceptLanguage }: { langParam?: string, acceptLanguage?: string }): string | undefined {
    // *
    // de-DE
    // fr
    // fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5
    type QualityValue = { value: string, q: number };
    const qualityValues: QualityValue[] = [];
    if (langParam) qualityValues.push({ value: langParam.toLowerCase(), q: 2 });
    if (acceptLanguage) {
        qualityValues.push(...acceptLanguage.split(',').map(v => v.toLowerCase().trim()).filter(v => v.length > 0).map(v => { 
            const m = /^([a-zA-Z0-9-_]+)(;q=([0-9.]+))?$/.exec(v);
            if (!m) return undefined;
            const [ _, value, _2, qStr ] = m;
            return { value, q: qStr === undefined ? 1 : parseFloat(qStr) };
        }).filter(v => v !== undefined) as QualityValue[]);
    }
    if (qualityValues.length === 0) return undefined;
    qualityValues.sort((a, b) => b.q - a.q);
    for (const { value } of qualityValues) {
        const lang = value.split('-').at(0) ?? value;
        if (lang === 'up') return lang; // for testing
        if (supportedLanguages.includes(lang)) return lang;
    }
    return undefined;
}

export const supportedLanguageLabels: Record<string, string> = {
    en: 'English (US)',
    fr: 'Français',
};

export const supportedLanguages = Object.keys(supportedLanguageLabels);

export class Translations {
    private readonly translatedStringsJson: string;
    
    private translatedStrings?: TranslatedStrings;

    constructor(translatedStringsJson: string) {
        this.translatedStringsJson = translatedStringsJson;
    }

    compute({ searchParams, acceptLanguage }: { searchParams: URLSearchParams, acceptLanguage: string | undefined }): { lang: string | undefined, contentLanguage: string, translatedStrings: TranslatedStrings } {
        if (!this.translatedStrings) this.translatedStrings = JSON.parse(this.translatedStringsJson) as TranslatedStrings;
        const translatedStrings = this.translatedStrings;
        const langParam = searchParams.get('lang') ?? undefined;
        const lang = Object.keys(translatedStrings).length > 0 || langParam === 'up' ? computePreferredSupportedLanguage({ langParam, acceptLanguage }) : undefined;
        const contentLanguage = lang ?? 'en';
        return { lang, contentLanguage, translatedStrings };
    }
}

//

const withCommas = new Intl.NumberFormat('en-US');
