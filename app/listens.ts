import { SlIconButton, element } from './elements.ts';
import { increment, incrementAll } from '../worker/summaries.ts';
import { Chart, TooltipItem, sortBy } from './deps.ts';
import { EpisodeInfo } from '../worker/routes/api_shows_model.ts';

type Opts = { episodeListens: Record<string, { minuteMaps: string[], appCounts: Record<string, number> }> | undefined, episodes: readonly EpisodeInfo[], knownAppLinks: Record<string, string> | undefined, debug: boolean };

export const makeListens = ({ episodeListens, episodes, knownAppLinks = {} }: Opts) => {

    const [ 
        listensSection,
        listens25,
        listens50,
        listens90,
        listensCount,
        listensFromAppTemplate,
        listensBasedOn,
        listensGraph,
        listensGraphFooter,
        listensEpisode,
        listensGraphFooterPrevious,
        listensGraphFooterNext,
    ] = [
        element('listens-section'),
        element('listens-25'),
        element('listens-50'),
        element('listens-90'),
        element('listens-count'),
        element<HTMLTemplateElement>('listens-from-app'),
        element('listens-based-on'),
        element<HTMLCanvasElement>('listens-graph'),
        element('listens-graph-footer'),
        element('listens-episode'),
        element<SlIconButton>('listens-graph-footer-previous'),
        element<SlIconButton>('listens-graph-footer-next'),
    ];

    if (!episodeListens) return;

    listensSection.classList.remove('hidden');

    let listens25Count = 0, listens50Count = 0, listens90Count = 0, listens = 0;
    for (const minuteMap of Object.values(episodeListens).flatMap(v => v.minuteMaps)) {
        const listened = [ ...minuteMap ].filter(v => v === '1').length;
        const pct = listened / minuteMap.length;
        if (pct >= .25) listens25Count++;
        if (pct >= .50) listens50Count++;
        if (pct >= .90) listens90Count++;
        listens++;
    }
    listens25.textContent = `${Math.round(listens25Count / listens * 100)}%`;
    listens50.textContent = `${Math.round(listens50Count / listens * 100)}%`;
    listens90.textContent = `${Math.round(listens90Count / listens * 100)}%`;

    const allAppCounts = Object.values(episodeListens).map(v => v.appCounts).reduce(incrementAll, {});
    listensCount.textContent = Object.values(allAppCounts).reduce((a, b) => a + b, 0).toString();
    const apps = Object.keys(allAppCounts).length;
    sortBy(Object.entries(allAppCounts), v => -v[1]).forEach(([ appName, count ], i) => {
        if (i > 0) listensBasedOn.appendChild(document.createTextNode(i < (apps - 1) ? ', ': ', and '));
        const item = listensFromAppTemplate.content.cloneNode(true) as HTMLElement;
        const a = item.querySelector('a')!;
        a.textContent = appName;
        a.href = knownAppLinks[appName] ?? '#';
        item.querySelector('span')!.textContent = `${count}`;
        listensBasedOn.appendChild(item);
    });
    
    const episodeListensEntries = Object.entries(episodeListens).filter(v => v[1].minuteMaps.length > 0 && v[1].minuteMaps[0].length >= 3);
    if (episodeListensEntries.length === 0) return;

    [ listensGraph, listensGraphFooter ].forEach(v => v.classList.remove('hidden'));

    let index = episodeListensEntries[1] && episodeListensEntries[1][1].minuteMaps.length > episodeListensEntries[0][1].minuteMaps.length ? 1 : 0;
    let chart: Chart | undefined;

    const updateGraph = () => {
        const [ episodeGuid, { minuteMaps } ] = episodeListensEntries[index];
        if (chart) chart.destroy();
        const minutes: Record<string, number> = {};
        for (const minuteMap of minuteMaps) {
            [...minuteMap].forEach((v, i) => increment(minutes, (i + 1).toString(), v === '1' ? 1 : 0));
        }
        chart = drawGraph(listensGraph, minutes, minuteMaps.length);
        const epName = episodes.find(v => v.itemGuid === episodeGuid)?.title ?? episodeGuid;
        listensEpisode.textContent = `‘${epName}’`;
        listensGraphFooterPrevious.disabled = index === episodeListensEntries.length - 1;
        listensGraphFooterNext.disabled = index === 0;
    }
    updateGraph();

    listensGraphFooterPrevious.onclick = () => {
        index = Math.min(index + 1, episodeListensEntries.length - 1);
        updateGraph();
    };

    listensGraphFooterNext.onclick = () => {
        index = Math.max(index - 1, 0);
        updateGraph();
    };

};

//

function drawGraph(canvas: HTMLCanvasElement, labelsAndValues: Record<string, number>, sessions: number) {
    const ctx = canvas.getContext('2d')!;

    const values = Object.values(labelsAndValues);
    const maxValue = Math.min(Math.round(Math.max(...values) * 1.25), sessions);
    const minValue = 0;
    const labels = Object.keys(labelsAndValues);
    const data = {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: 'rgba(75, 192, 192, 0.75)',
                hoverBackgroundColor: 'rgba(75, 192, 192, 1)',
                pointRadius: 0,
                borderWidth: 0,
                barPercentage: 1,
                categoryPercentage: .95,
            },
        ]
    };

    const config = {
        type: 'bar',
        data,
        options: {
            scales: {
                x: {
                    display: false,
                },
                y: {
                    display: false,
                    min: minValue,
                    max: maxValue,
                }
            },
            animation: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    displayColors: false,
                    footerColor: 'rgba(154, 52, 18, 1)',
                    callbacks: {
                        title: (items: TooltipItem<never>[]) => `Minute ${items[0].label}`,
                        // deno-lint-ignore no-explicit-any
                        label: (item: any) => `${item.parsed.y} of ${sessions} anonymized sessions (${Math.round(item.parsed.y / sessions * 100)}%)`,
                    }
                },
            },
        },
    };

    // deno-lint-ignore no-explicit-any
    const chart = new Chart(ctx, config as any);
    return chart;
}
