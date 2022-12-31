import { makeTopBox } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> };

export const makeTopCountries = ({ showSlug, monthlyDimensionDownloads }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['countryCode'] ?? {}]));

    const regionalIndicators = Object.fromEntries([...new Array(26).keys()].map(v => [ String.fromCharCode('A'.charCodeAt(0) + v), String.fromCodePoint('🇦'.codePointAt(0)! + v) ]));
    const computeEmoji = (countryCode: string) => ({ 'T1': '🧅', 'XX': '❔' })[countryCode] ?? [...countryCode].map(v => regionalIndicators[v]).join('');

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
    });
};

//

const regionNamesInEnglish = new Intl.DisplayNames([ 'en' ], { type: 'region' });

function tryComputeRegionNameInEnglish(countryCode: string): string | undefined {
    try {
        return regionNamesInEnglish.of(countryCode);
    } catch (e) {
        console.warn(`tryComputeRegionNameInEnglish: ${e.stack || e} for ${countryCode}`);
    }
}

function computeCountryName(countryCode: string): string {
    if (countryCode === 'T1') return 'Tor traffic';
    if (countryCode === 'XX') return 'Unknown';
    return (countryCode.length === 2 ? tryComputeRegionNameInEnglish(countryCode) : undefined ) ?? countryCode;
}
