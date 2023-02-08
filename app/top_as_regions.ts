import { makeTopBox } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number> };

export const makeTopAsRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['asRegion'] ?? {}]));
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
        type: 'as-regions',
        showSlug,
        exportId: 'top-as-regions-export',
        previousId: 'top-as-regions-month-previous',
        nextId: 'top-as-regions-month-next',
        monthId: 'top-as-regions-month',
        listId: 'top-as-regions',
        templateId: 'top-as-regions-row',
        cardId: 'top-as-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [ 'asRegion' ],
        computeEmoji,
        computeName: computeRegionName,
    });
};

//

function computeRegionName(regionCountry: string): string {
    const region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    return region;
}
