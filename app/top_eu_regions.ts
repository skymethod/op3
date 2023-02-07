import { makeTopBox } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number> };

export const makeTopEuRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['euRegion'] ?? {}]));
    Object.values(monthlyDownloads).forEach(v => {
        delete v['Unknown, XX'];
    });
    const regionalIndicators = Object.fromEntries([...new Array(26).keys()].map(v => [ String.fromCharCode('A'.charCodeAt(0) + v), String.fromCodePoint('🇦'.codePointAt(0)! + v) ]));
    const computeEmoji = (euRegion: string) => {
        const countryCode = euRegion.split(',').at(-1)!.trim();
        return ({ 'T1': '🧅', 'XX': '❔' })[countryCode] ?? [...countryCode].map(v => regionalIndicators[v]).join('');
    };

    return makeTopBox({
        type: 'eu-regions',
        showSlug,
        exportId: 'top-eu-regions-export',
        previousId: 'top-eu-regions-month-previous',
        nextId: 'top-eu-regions-month-next',
        monthId: 'top-eu-regions-month',
        listId: 'top-eu-regions',
        templateId: 'top-eu-regions-row',
        cardId: 'top-eu-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [ 'euRegion' ],
        computeEmoji,
        computeName: computeRegionName,
    });
};

//

function computeRegionName(euRegion: string): string {
    let region = euRegion.substring(0, euRegion.length - ', XX'.length).trim();
    region = { 'Free and Hanseatic City of Hamburg': 'Hamburg' }[region] ?? region;
    return region;
}
