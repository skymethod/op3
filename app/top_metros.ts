import { METROS } from './metros.ts';
import { computeMonthlyDownloads, makeTopBox, regionCountryFunctions } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, downloadsPerMonth: Record<string, number> };

export const makeTopMetros = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth }: Opts) => {
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'metroCode');
    const { computeUrl } = regionCountryFunctions('US');
    
    return makeTopBox({
        type: 'metros',
        showSlug,
        exportId: 'top-metros-export',
        previousId: 'top-metros-month-previous',
        nextId: 'top-metros-month-next',
        monthId: 'top-metros-month',
        listId: 'top-metros',
        templateId: 'top-metros-row',
        cardId: 'top-metros-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [ 'metroCode', 'metroName' ],
        computeName: computeMetroName,
        computeUrl: v => computeUrl(computeMetroName(v)),
    });
};

//

function computeMetroName(metroCode: string): string {
    return METROS[metroCode] ?? `Metro ${metroCode}`;
}
