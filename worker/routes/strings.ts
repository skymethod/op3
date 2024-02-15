
export function replacePlaceholders(str: string, nameValuePairs: [string, string][]): string {
    let i = 0;
    return str.replace(/%d/g, () => {
        const nvp = nameValuePairs[i];
        if (nvp === undefined) throw new Error(`replacePlaceholders: Bad input: ${str}, ${nameValuePairs.map(v => v.join('=')).join(',')}`);
        i++;
        return nvp[1];
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
    if (lang === undefined || translatedStrings === undefined) return stringValue;
    const translations = translatedStrings[stringName]; if (translations === undefined) return stringValue;
    return translations[lang] ?? stringValue;
}
