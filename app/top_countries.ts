import { makeTopBox } from './top_box.ts';

type Opts = { monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> };

export const makeTopCountries = ({ monthlyDimensionDownloads }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['countryCode'] ?? {}]));

    const regionalIndicators = Object.fromEntries([...new Array(26).keys()].map(v => [ String.fromCharCode('A'.charCodeAt(0) + v), String.fromCodePoint('🇦'.codePointAt(0)! + v) ]));

    return makeTopBox({
        type: 'countries',
        exportId: 'top-countries-export',
        previousId: 'top-countries-month-previous',
        nextId: 'top-countries-month-next',
        monthId: 'top-countries-month',
        listId: 'top-countries',
        templateId: 'top-countries-row',
        monthlyDownloads,
        tsvHeaderNames: [ 'countryCode', 'countryName' ],
        computeEmoji: countryCode => [...countryCode].map(v => regionalIndicators[v]).join(''),
        computeName: computeCountryName,
    });
};

//

const regionNamesInEnglish = new Intl.DisplayNames([ 'en' ], { type: 'region' });

function computeCountryName(countryCode: string): string {
    return (countryCode.length === 2 ? regionNamesInEnglish.of(countryCode) : undefined ) ?? countryCode;
}
