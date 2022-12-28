import { sortBy } from './deps.ts';
import { element, removeAllChildren, SlIconButton } from './elements.ts';
import { computeMonthName } from './time.ts';

type Opts = { monthlyCountryDownloads: Record<string, Record<string, number>> };

export const makeTopCountries = ({ monthlyCountryDownloads }: Opts) => {

    const [
        topCountriesMonthPreviousButton,
        topCountriesMonthDiv,
        topCountriesMonthNextButton,
        topCountriesList,
        topCountriesRowTemplate
    ] = [
        element<SlIconButton>('top-countries-month-previous'),
        element('top-countries-month'),
        element<SlIconButton>('top-countries-month-next'),
        element('top-countries'),
        element<HTMLTemplateElement>('top-countries-row'),
    ];

    const months = Object.keys(monthlyCountryDownloads);
    let monthIndex = months.length - 2;

    const regionalIndicators = Object.fromEntries([...new Array(26).keys()].map(v => [ String.fromCharCode('A'.charCodeAt(0) + v), String.fromCodePoint('🇦'.codePointAt(0)! + v) ]));
    const updateTableForMonth = () => {
        topCountriesMonthDiv.textContent = computeMonthName(Object.keys(monthlyCountryDownloads)[monthIndex], { includeYear: true });
        const countryDownloads = Object.values(monthlyCountryDownloads)[monthIndex];
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
            dt.textContent = countryCode;
            const dd = item.querySelector('dd')!;
            dd.textContent = (downloads / totalDownloads * 100).toFixed(2).toString() + '%';
            topCountriesList.appendChild(item);
        }
        topCountriesMonthPreviousButton.disabled = monthIndex === 0;
        topCountriesMonthNextButton.disabled = monthIndex === (months.length - 1);
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
