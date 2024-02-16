import { computeMonthlyDownloads, makeTopBox, regionCountryFunctions } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number>, strings: Record<string, string> };

export const makeTopCaRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings }: Opts) => {
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'caRegion');
    const { computeUrl } = regionCountryFunctions('CA');

    return makeTopBox({
        type: 'ca-regions',
        showSlug,
        exportId: 'top-ca-regions-export',
        previousId: 'top-ca-regions-month-previous',
        nextId: 'top-ca-regions-month-next',
        monthId: 'top-ca-regions-month',
        listId: 'top-ca-regions',
        templateId: 'top-ca-regions-row',
        cardId: 'top-ca-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [ 'caRegion' ],
        computeName: v => v,
        computeUrl,
        strings,
    });
};
