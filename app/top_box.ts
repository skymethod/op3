import { sortBy } from './deps.ts';
import { element, removeAllChildren, SlIconButton } from './elements.ts';
import { computeMonthName, download, pluralize } from './util.ts';

type Opts = {
    type: string,
    showSlug: string,
    exportId: string,
    previousId: string,
    nextId: string,
    monthId: string,
    listId: string,
    templateId: string,
    cardId?: string,
    monthlyDownloads: Record<string, Record<string, number>>,
    downloadsPerMonth?: Record<string, number>,
    tsvHeaderNames: string[],
    computeEmoji?: (key: string) => string,
    computeName: (key: string) => string,
};

export const makeTopBox = ({ type, showSlug, exportId, previousId, monthId, nextId, listId, templateId, cardId, monthlyDownloads, downloadsPerMonth, tsvHeaderNames, computeEmoji, computeName }: Opts) => {

    const [
        exportButton,
        previousButton,
        monthDiv,
        nextButton,
        list,
        rowTemplate,
    ] = [
        element<SlIconButton>(exportId),
        element<SlIconButton>(previousId),
        element(monthId),
        element<SlIconButton>(nextId),
        element(listId),
        element<HTMLTemplateElement>(templateId),
    ];
    const card = cardId ? element(cardId) : undefined;

    const months = Object.keys(monthlyDownloads);
    const monthlyDownloadsValues = Object.values(monthlyDownloads);
    const computeInitialMonthIndex = () => {
        const lastMonthsDownloads = Object.values(monthlyDownloadsValues.at(-2) ?? {}).reduce((a, b) => a + b, 0);
        const thisMonthsDownloads = Object.values(monthlyDownloadsValues.at(-1)!).reduce((a, b) => a + b, 0);
        return months.length - (lastMonthsDownloads > thisMonthsDownloads ? 2 : 1);
    }
    let monthIndex = computeInitialMonthIndex();

    const tsvRows: string[][] = [ [ 'rank', ...tsvHeaderNames, 'downloads', 'pct' ]];
    exportButton.onclick = () => {
        const tsv = tsvRows.map(v => v.join('\t')).join('\n');
        const filename = `${showSlug}-top-${type}-${months[monthIndex]}.tsv`;
        download(tsv, { type: 'text/plain', filename });
    };

    let first = true;
    const updateTableForMonth = () => {
        const month = months[monthIndex];
        monthDiv.textContent = computeMonthName(month, { includeYear: true });
        const monthDownloads = Object.values(monthlyDownloads)[monthIndex] ?? {};
        const totalDownloads = downloadsPerMonth ? downloadsPerMonth[month] : Object.values(monthDownloads).reduce((a, b) => a + b, 0);
        const pct = Object.values(monthDownloads).reduce((a, b) => a + b, 0) / totalDownloads;
        if (first && card && cardId) {
            // hide the entire card if low pct of downloads
            const hide = pct < 0.03;
            console.log({ cardId, pct, hide });
            if (hide) {
                card.style.display = 'none';
                return;
            }
        }
        first = false;
        removeAllChildren(list);
       
        const sorted = sortBy(Object.entries(monthDownloads), v => -v[1]);
        for (const [ key, downloads ] of sorted) {
            const item = rowTemplate.content.cloneNode(true) as HTMLElement;

            const span = item.querySelector('span')!;
            if (computeEmoji) {
                span.textContent = computeEmoji(key);
            }

            const dt = item.querySelector('dt')!;
            if (key.startsWith('https://')) {
                dt.textContent = '';
                const a = document.createElement('a');
                a.textContent = new URL(key).host;
                a.href = key;
                a.className = 'text-white';
                a.target = '_blank';
                a.rel = 'nofollow noopener noreferrer';
                dt.appendChild(a);
            } else {
                const name = computeName(key);
                dt.textContent = name;
                dt.title = name;
            }

            const dd = item.querySelector('dd')!;
            dd.textContent = (downloads / totalDownloads * 100).toFixed(2).toString() + '%';
            dd.title = pluralize(downloads, 'download');

            list.appendChild(item);
        }
        previousButton.disabled = monthIndex === 0;
        nextButton.disabled = monthIndex === (months.length - 1);

        tsvRows.splice(1);
        let rank = 1;
        for (const [ keyStr, downloads ] of sorted) {
            const key = keyStr.startsWith('https://') ? new URL(keyStr).hostname : keyStr;
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
