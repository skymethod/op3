import { makeTopBox } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number> };

export const makeTopCaRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['caRegion'] ?? {}]));
    Object.values(monthlyDownloads).forEach(v => {
        delete v['Unknown'];
    });

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
    });
};
