import { element } from './elements.ts';
import { increment, incrementAll } from '../worker/summaries.ts';
import { Chart, TooltipItem, sortBy } from './deps.ts';
import { EpisodeInfo } from '../worker/routes/api_shows_model.ts';

type Opts = { episodeListens: Record<string, { minuteMaps: string[], appCounts: Record<string, number> }> | undefined, episodes: readonly EpisodeInfo[], debug: boolean };

export const makeListens = ({ episodeListens, episodes }: Opts) => {

    const [ 
        listensSection,
        listens25,
        listens50,
        listens90,
        listensCount,
        listensFromAppTemplate,
        listensBasedOn,
        listensGraph,
        listensEpisode,
    ] = [
        element('listens-section'),
        element('listens-25'),
        element('listens-50'),
        element('listens-90'),
        element('listens-count'),
        element<HTMLTemplateElement>('listens-from-app'),
        element('listens-based-on'),
        element<HTMLCanvasElement>('listens-graph'),
        element('listens-episode'),
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
    
    const minutes: Record<string, number> = {};
    const episodeListensEntries = Object.entries(episodeListens);
    for (let i = 0; i < episodeListensEntries.length; i++) {
        const [ episodeGuid, { minuteMaps } ] = episodeListensEntries[i];
        if (i === 0 && episodeListensEntries[1] && episodeListensEntries[1][1].minuteMaps.length > minuteMaps.length) continue;
        for (const minuteMap of minuteMaps) {
            [...minuteMap].forEach((v, i) => increment(minutes, (i + 1).toString(), v === '1' ? 1 : 0));
        }
        drawGraph(listensGraph, minutes, minuteMaps.length);
        const epName = episodes.find(v => v.itemGuid === episodeGuid)?.title ?? episodeGuid;
        listensEpisode.textContent = `‘${epName}’`;
        break;
    }
};

//

const knownAppLinks: Record<string, string> = {
    'Fountain': 'https://www.fountain.fm/',
    'Castamatic': 'https://castamatic.com/',
    'Podverse': 'https://podverse.fm/',
    'CurioCaster': 'https://curiocaster.com/',
    'TrueFans': 'https://truefans.fm/',
    'PodcastGuru': 'https://podcastguru.io/',
    'Podfriend': 'https://www.podfriend.com/',
    'Breez': 'https://breez.technology/',
}


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
                        label: (item: any) => `${item.parsed.y} of ${sessions} observed sessions (${Math.round(item.parsed.y / sessions * 100)}%)`,
                    }
                },
            },
        },
    };

    // deno-lint-ignore no-explicit-any
    const chart = new Chart(ctx, config as any);
    return chart;
}
