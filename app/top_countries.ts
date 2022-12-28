import { sortBy } from './deps.ts';
import { element, removeAllChildren, SlIconButton } from './elements.ts';
import { computeMonthName, download } from './util.ts';

type Opts = { monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> };

export const makeTopCountries = ({ monthlyDimensionDownloads }: Opts) => {

    const [
        topCountriesExportButton,
        topCountriesMonthPreviousButton,
        topCountriesMonthDiv,
        topCountriesMonthNextButton,
        topCountriesList,
        topCountriesRowTemplate
    ] = [
        element<SlIconButton>('top-countries-export'),
        element<SlIconButton>('top-countries-month-previous'),
        element('top-countries-month'),
        element<SlIconButton>('top-countries-month-next'),
        element('top-countries'),
        element<HTMLTemplateElement>('top-countries-row'),
    ];

    const months = Object.keys(monthlyDimensionDownloads);
    let monthIndex = months.length - 2;

    const tsvRows: string[][] = [ [ 'rank', 'countryCode', 'countryName', 'downloads', 'pct' ]];
    topCountriesExportButton.onclick = () => {
        const tsv = tsvRows.map(v => v.join('\t')).join('\n');
        const filename = `top-countries-${computeMonthName(months[monthIndex], { includeYear: true }).toLowerCase().replace(' ', '-')}.tsv`;
        download(tsv, { type: 'text/plain', filename });
    };

    const regionalIndicators = Object.fromEntries([...new Array(26).keys()].map(v => [ String.fromCharCode('A'.charCodeAt(0) + v), String.fromCodePoint('🇦'.codePointAt(0)! + v) ]));
    const updateTableForMonth = () => {
        topCountriesMonthDiv.textContent = computeMonthName(months[monthIndex], { includeYear: true });
        const countryDownloads = Object.values(monthlyDimensionDownloads)[monthIndex]['countryCode'] ?? {};
        const totalDownloads = Object.values(countryDownloads).reduce((a, b) => a + b, 0);
        removeAllChildren(topCountriesList);
       
        const sorted = sortBy(Object.entries(countryDownloads), v => -v[1]);
        const display = sorted.slice(0, 10);
        const allOthers = sorted.slice(10).map(v => v[1]).reduce((a, b) => a + b, 0);
        if (allOthers > 0) display.push([ '(all others)', allOthers ]);
        for (const [ countryCode, downloads ] of display) {
            const item = topCountriesRowTemplate.content.cloneNode(true) as HTMLElement;
            const span = item.querySelector('span')!;
            span.textContent = [...countryCode].map(v => regionalIndicators[v]).join('');
            const dt = item.querySelector('dt')!;
            dt.textContent = computeCountryName(countryCode);
            const dd = item.querySelector('dd')!;
            dd.textContent = (downloads / totalDownloads * 100).toFixed(2).toString() + '%';
            topCountriesList.appendChild(item);
        }
        topCountriesMonthPreviousButton.disabled = monthIndex === 0;
        topCountriesMonthNextButton.disabled = monthIndex === (months.length - 1);

        tsvRows.splice(1);
        let rank = 1;
        for (const [ countryCode, downloads ] of sorted) {
            const countryName = computeCountryName(countryCode);
            const pct = (downloads / totalDownloads * 100).toFixed(4);
            tsvRows.push([ `${rank++}`, countryCode, countryName, downloads.toString(), pct ]);
        }
    };

    topCountriesMonthPreviousButton.onclick = () => {
        if (monthIndex > 0) {
            monthIndex--;
            updateTableForMonth();
        }
    };

    topCountriesMonthNextButton.onclick = () => {
        if (monthIndex < (months.length - 1)) {
            monthIndex++;
            updateTableForMonth();
        }
    };
   
    updateTableForMonth();

    function update() {
      
    }

    update();

    return { update };
};

//

const regionNamesInEnglish = new Intl.DisplayNames([ 'en' ], { type: 'region' });

function computeCountryName(countryCode: string): string {
    return (countryCode.length === 2 ? regionNamesInEnglish.of(countryCode) : undefined ) ?? countryCode;
}
