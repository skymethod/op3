import { computeMonthlyDownloads, makeTopBox, regionCountryFunctions } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number>, strings: Record<string, string>, lang: string | undefined };

export const makeTopAfRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang }: Opts) => {
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'afRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();

    return makeTopBox({
        type: 'af-regions',
        showSlug,
        exportId: 'top-af-regions-export',
        previousId: 'top-af-regions-month-previous',
        nextId: 'top-af-regions-month-next',
        monthId: 'top-af-regions-month',
        listId: 'top-af-regions',
        templateId: 'top-af-regions-row',
        cardId: 'top-af-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [ 'afRegion' ],
        computeEmoji,
        computeName: computeRegionName,
        computeUrl,
        strings,
        lang,
    });
};

//

function computeRegionName(regionCountry: string): string {
    const region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    return region;
}
