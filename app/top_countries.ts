import { computeCountryName, computeMonthlyDownloads, makeTopBox, regionCountryFunctions } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, strings: Record<string, string>, lang: string | undefined };

export const makeTopCountries = ({ showSlug, monthlyDimensionDownloads, strings, lang }: Opts) => {
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'countryCode');
    const { computeEmoji, computeUrl } = regionCountryFunctions();

    return makeTopBox({
        type: 'countries',
        showSlug,
        exportId: 'top-countries-export',
        previousId: 'top-countries-month-previous',
        nextId: 'top-countries-month-next',
        monthId: 'top-countries-month',
        listId: 'top-countries',
        templateId: 'top-countries-row',
        monthlyDownloads,
        tsvHeaderNames: [ 'countryCode', 'countryName' ],
        computeEmoji,
        computeName: computeCountryName,
        computeUrl,
        strings,
        lang,
    });
};
