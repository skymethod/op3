import { increment } from '../worker/summaries.ts';
import { Chart } from './deps.ts';
import { element, SlMenuItem } from './elements.ts';

type Opts = { hourlyDownloads: Record<string, number>, hourMarkers: Record<string, unknown> };

export const makeDownloadsGraph = ({ hourlyDownloads, hourMarkers }: Opts) => {

    const [ 
        downloadsGraphCanvas,
        downloadsGraphPreviousButton,
        downloadsGraphGranularitySpan,
        downloadsGraphOptionsMenu,
        downloadsGraphRangeSpan,
        downloadsGraphNextButton,
    ] = [
        element<HTMLCanvasElement>('downloads-graph'),
        element('downloads-graph-previous'),
        element('downloads-graph-granularity'),
        element('downloads-graph-options'),
        element('downloads-graph-range'),
        element('downloads-graph-next'),
    ];

    let granularity: Granularity = 'hourly';
    let showEpisodeMarkers = true;

    downloadsGraphOptionsMenu.addEventListener('sl-select', ev => {
        const e = ev as CustomEvent<{ item: SlMenuItem }>;
        const item = e.detail.item;
        const { value } = item;
        if (isGranularity(value)) {
            if (granularity === value) return;
            granularity = value; update();
            redrawChart();
        } else if (value === 'episode-markers') {
            showEpisodeMarkers = !showEpisodeMarkers; update();
            redrawChart();
        }
    });

    let chart: Chart;

    function redrawChart() {
        if (chart) chart.destroy();
        chart = drawDownloadsChart(downloadsGraphCanvas, hourlyDownloads, granularity, showEpisodeMarkers ? hourMarkers : undefined);
    }

    function update() {
        downloadsGraphGranularitySpan.textContent = { 
            'hourly': 'Hourly',
            'six-hourly': '6-hourly',
            'twelve-hourly': '12-hourly',
            'daily': 'Daily',
        }[granularity] + ' Downloads';

        const items = downloadsGraphOptionsMenu.querySelectorAll('sl-menu-item') as NodeListOf<SlMenuItem>;
        for (const item of items) {
            const { value } = item;
            if (isGranularity(value)) {
                item.checked = value === granularity;
            } else if (value === 'episode-markers') {
                item.checked = showEpisodeMarkers;
            }
        }
    }

    update();
    redrawChart();

    return { update };
};

//

type Granularity = 'hourly' | 'six-hourly' | 'twelve-hourly' | 'daily';

function isGranularity(obj: string): obj is Granularity {
    return [ 'hourly' , 'six-hourly' , 'twelve-hourly' , 'daily' ].includes(obj);
}

//

function computeDownloads(hourlyDownloads: Record<string, number>, granularity: Granularity): Record<string, number> {
    if (granularity === 'hourly') return hourlyDownloads;
    if (granularity === 'daily') {
        const rt: Record<string, number> = {};
        for (const [ hour, downloads ] of Object.entries(hourlyDownloads)) {
            const key = hour.substring(0, 10);
            increment(rt, key, downloads);
        }
        return rt;
    }
    throw new Error(`Unsupported granularity: ${granularity}`);
}

function drawDownloadsChart(canvas: HTMLCanvasElement, hourlyDownloads: Record<string, number>, granularity: Granularity, hourMarkers?: Record<string, unknown>): Chart {
    const downloads = computeDownloads(hourlyDownloads, granularity);
    const maxDownloads = Math.max(...Object.values(downloads));
    const markerData = Object.keys(downloads).map(v => {
        if (granularity === 'hourly' && hourMarkers && hourMarkers[v]) return maxDownloads;
        return undefined;
    });

    const ctx = canvas.getContext('2d')!;

    const labels = Object.keys(downloads);
    const data = {
        labels,
        datasets: [
            {
                data: Object.values(downloads),
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                pointRadius: 0,
                borderWidth: 1,
            },
            {
                type: 'bar',
                data: markerData,
                backgroundColor: 'rgba(154, 52, 18, 0.75)',
            },
        ]
    };

    const config = {
        type: 'line',
        data,
        options: {
            animation: {
                duration: 100,
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: {
                    display: false,
                }
            },
        }
    };

    // deno-lint-ignore no-explicit-any
    return new Chart(ctx, config as any);
}
