import { computeMonthlyDownloads, makeTopBox, regionCountryFunctions } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number>, strings: Record<string, string>, lang: string | undefined };

export const makeTopEuRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang }: Opts) => {
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'euRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();

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
        computeUrl,
        strings,
        lang,
    });
};

//

function computeRegionName(regionCountry: string): string {
    let region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    region = { 'Free and Hanseatic City of Hamburg': 'Hamburg' }[region] ?? region;
    return region;
}
