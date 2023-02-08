import { computeMonthlyDownloads, makeTopBox, regionCountryFunctions } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number> };

export const makeTopLatamRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth }: Opts) => {
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'latamRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();

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
        computeUrl,
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
