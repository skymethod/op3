import { makeTopBox } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number> };

export const makeTopLatamRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['latamRegion'] ?? {}]));
    Object.values(monthlyDownloads).forEach(v => {
        for (const name of Object.keys(v)) {
            if (name.startsWith('Unknown, ')) {
                delete v[name];
            }
        }
    });
    const regionalIndicators = Object.fromEntries([...new Array(26).keys()].map(v => [ String.fromCharCode('A'.charCodeAt(0) + v), String.fromCodePoint('🇦'.codePointAt(0)! + v) ]));
    const computeEmoji = (regionCountry: string) => {
        const countryCode = regionCountry.split(',').at(-1)!.trim();
        return ({ 'T1': '🧅', 'XX': '❔' })[countryCode] ?? [...countryCode].map(v => regionalIndicators[v]).join('');
    };

    return makeTopBox({
        type: 'latam-regions',
        showSlug,
        exportId: 'top-latam-regions-export',
        previousId: 'top-latam-regions-month-previous',
        nextId: 'top-latam-regions-month-next',
        monthId: 'top-latam-regions-month',
        listId: 'top-latam-regions',
        templateId: 'top-latam-regions-row',
        cardId: 'top-latam-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [ 'latamRegion' ],
        computeEmoji,
        computeName: computeRegionName,
    });
};

//

function computeRegionName(regionCountry: string): string {
    let region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    let m = /^(Departamento del? |Region del? |Provincia del? |Provincia )(.*)$/.exec(region);
    if (m) region = m[2];
    m = /^(.*)( Department| Region)$/.exec(region);
    if (m) region = m[1];
    region = { 'Santo Domingo de los Tsachilas': 'Santo Domingo' }[region] ?? region;
    return region;
}
