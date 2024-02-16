import { computeMonthlyDownloads, makeTopBox, regionCountryFunctions } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number>, strings: Record<string, string>, lang: string | undefined };

export const makeTopAsRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang }: Opts) => {
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'asRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();

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
