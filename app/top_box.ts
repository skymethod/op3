import { sortBy } from './deps.ts';
import { element, removeAllChildren, SlIconButton } from './elements.ts';
import { computeMonthName, download, pluralize } from './util.ts';

type Opts = {
    type: string,
    exportId: string,
    previousId: string,
    nextId: string,
    monthId: string,
    listId: string,
    templateId: string,
    monthlyDownloads: Record<string, Record<string, number>>,
    downloadsDenominator?: (month: string) => number,
    tsvHeaderNames: string[],
    computeEmoji?: (key: string) => string,
    computeName: (key: string) => string,
};

export const makeTopBox = ({ type, exportId, previousId, monthId, nextId, listId, templateId, monthlyDownloads, downloadsDenominator, tsvHeaderNames, computeEmoji, computeName }: Opts) => {

    const [
        exportButton,
        previousButton,
        monthDiv,
        nextButton,
        list,
        rowTemplate
    ] = [
        element<SlIconButton>(exportId),
        element<SlIconButton>(previousId),
        element(monthId),
        element<SlIconButton>(nextId),
        element(listId),
        element<HTMLTemplateElement>(templateId),
    ];

    const months = Object.keys(monthlyDownloads);
    let monthIndex = months.length - 2;

    const tsvRows: string[][] = [ [ 'rank', ...tsvHeaderNames, 'downloads', 'pct' ]];
    exportButton.onclick = () => {
        const tsv = tsvRows.map(v => v.join('\t')).join('\n');
        const filename = `top-${type}-${computeMonthName(months[monthIndex], { includeYear: true }).toLowerCase().replace(' ', '-')}.tsv`;
        download(tsv, { type: 'text/plain', filename });
    };

    const updateTableForMonth = () => {
        const month = months[monthIndex];
        monthDiv.textContent = computeMonthName(month, { includeYear: true });
        const monthDownloads = Object.values(monthlyDownloads)[monthIndex] ?? {};
        const totalDownloads = downloadsDenominator ? downloadsDenominator(month) : Object.values(monthDownloads).reduce((a, b) => a + b, 0);
        removeAllChildren(list);
       
        const sorted = sortBy(Object.entries(monthDownloads), v => -v[1]);
        for (const [ key, downloads ] of sorted) {
            const item = rowTemplate.content.cloneNode(true) as HTMLElement;

            const span = item.querySelector('span')!;
            if (computeEmoji) {
                span.textContent = computeEmoji(key);
            }

            const dt = item.querySelector('dt')!;
            const name = computeName(key);
            dt.textContent = name;
            dt.title = name;

            const dd = item.querySelector('dd')!;
            dd.textContent = (downloads / totalDownloads * 100).toFixed(2).toString() + '%';
            dd.title = pluralize(downloads, 'download');

            list.appendChild(item);
        }
        previousButton.disabled = monthIndex === 0;
        nextButton.disabled = monthIndex === (months.length - 1);

        tsvRows.splice(1);
        let rank = 1;
        for (const [ key, downloads ] of sorted) {
            const name = computeName(key);
            const pct = (downloads / totalDownloads * 100).toFixed(4);
            const fields = tsvHeaderNames.length === 1 ? [ name ] : [ key, name ];
            tsvRows.push([ `${rank++}`, ...fields, downloads.toString(), pct ]);
        }
    };

    previousButton.onclick = () => {
        if (monthIndex > 0) {
            monthIndex--;
            updateTableForMonth();
        }
    };

    nextButton.onclick = () => {
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
