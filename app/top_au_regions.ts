import { makeTopBox } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number> };

export const makeTopAuRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['auRegion'] ?? {}]));
    Object.values(monthlyDownloads).forEach(v => {
        for (const name of Object.keys(v)) {
            if (name.startsWith('Unknown, ')) {
                delete v[name];
            }
        }
    });
    const regionalIndicators = Object.fromEntries([...new Array(26).keys()].map(v => [ String.fromCharCode('A'.charCodeAt(0) + v), String.fromCodePoint('🇦'.codePointAt(0)! + v) ]));
    const computeEmoji = (euRegion: string) => {
        const countryCode = euRegion.split(',').at(-1)!.trim();
        return ({ 'T1': '🧅', 'XX': '❔' })[countryCode] ?? [...countryCode].map(v => regionalIndicators[v]).join('');
    };

    return makeTopBox({
        type: 'au-regions',
        showSlug,
        exportId: 'top-au-regions-export',
        previousId: 'top-au-regions-month-previous',
        nextId: 'top-au-regions-month-next',
        monthId: 'top-au-regions-month',
        listId: 'top-au-regions',
        templateId: 'top-au-regions-row',
        cardId: 'top-au-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [ 'auRegion' ],
        computeEmoji,
        computeName: computeRegionName,
    });
};

//

function computeRegionName(auRegion: string): string {
    const region = auRegion.substring(0, auRegion.length - ', XX'.length).trim();
    return region;
}
