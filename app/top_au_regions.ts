import { computeMonthlyDownloads, makeTopBox, regionCountryFunctions } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number> };

export const makeTopAuRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth }: Opts) => {
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'auRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();

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
        computeUrl,
    });
};

//

function computeRegionName(regionCountry: string): string {
    const region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    return region;
}
