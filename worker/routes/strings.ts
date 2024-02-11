
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
