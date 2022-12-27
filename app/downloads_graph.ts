import { checkMatches } from '../worker/check.ts';
import { increment } from '../worker/summaries.ts';
import { addDays } from '../worker/timestamp.ts';
import { Chart, TimeScale, Tooltip, TooltipItem } from './deps.ts';
import { element, SlIconButton, SlMenuItem } from './elements.ts';
import { computeMonthName } from './time.ts';

type Opts = { hourlyDownloads: Record<string, number>, hourMarkers: Record<string, unknown> };

export const makeDownloadsGraph = ({ hourlyDownloads, hourMarkers }: Opts) => {

    Chart.register(TimeScale);
    Chart.register(Tooltip);

    const [ 
        downloadsGraphCanvas,
        downloadsGraphPreviousButton,
        downloadsGraphGranularitySpan,
        downloadsGraphOptionsMenu,
        downloadsGraphRangeSpan,
        downloadsGraphNextButton,
    ] = [
        element<HTMLCanvasElement>('downloads-graph'),
        element<SlIconButton>('downloads-graph-previous'),
        element('downloads-graph-granularity'),
        element('downloads-graph-options'),
        element('downloads-graph-range'),
        element<SlIconButton>('downloads-graph-next'),
    ];

    const hours = Object.keys(hourlyDownloads);

    let granularity: Granularity = 'daily';
    let showEpisodeMarkers = true;
    let rangeStartHourIndex = 0;
    let rangeEndHourIndex = hours.length - 1;

    function recomputeRangeForGranularity() {
        if (granularity === 'daily') {
            rangeStartHourIndex = 0;
            rangeEndHourIndex = hours.length - 1;
        } else if (granularity === 'hourly') {
            const startOfDayInstant = `${hours[rangeEndHourIndex].substring(0, 10)}T00:00:00Z`;
            const rangeStartHour = addDays(startOfDayInstant, -4).toISOString().substring(0, 13);
            rangeStartHourIndex = Math.max(0, hours.indexOf(rangeStartHour));
        }
        redrawChart();
    }

    downloadsGraphPreviousButton.onclick = () => {
        if (granularity === 'hourly') {
            const startOfDayInstant = `${hours[rangeStartHourIndex].substring(0, 10)}T00:00:00Z`;
            const rangeStartHour = addDays(startOfDayInstant, -4).toISOString().substring(0, 13);
            rangeStartHourIndex = Math.max(0, hours.indexOf(rangeStartHour));
            rangeEndHourIndex = rangeStartHourIndex + 24 * 4 - 1;
            redrawChart();
            update();
        }
    }

    downloadsGraphNextButton.onclick = () => {
        if (granularity === 'hourly') {
            const startOfDayInstant = `${hours[rangeStartHourIndex].substring(0, 10)}T00:00:00Z`;
            const rangeStartHour = addDays(startOfDayInstant, 4).toISOString().substring(0, 13);
            rangeStartHourIndex = Math.max(0, hours.indexOf(rangeStartHour));
            rangeEndHourIndex = Math.min(rangeStartHourIndex + 24 * 4 - 1, hours.length - 1);
            redrawChart();
            update();
        }
    }

    downloadsGraphOptionsMenu.addEventListener('sl-select', ev => {
        const e = ev as CustomEvent<{ item: SlMenuItem }>;
        const item = e.detail.item;
        const { value } = item;
        if (isGranularity(value)) {
            if (granularity === value) return;
            granularity = value; 
            recomputeRangeForGranularity();
            update();
        } else if (value === 'episode-markers') {
            showEpisodeMarkers = !showEpisodeMarkers; update();
            redrawChart();
        }
    });

    let chart: Chart;

    function redrawChart() {
        if (chart) chart.destroy();
        const hourlyDownloadsToChart = Object.fromEntries(Object.entries(hourlyDownloads).slice(rangeStartHourIndex, rangeEndHourIndex + 1));
        chart = drawDownloadsChart(downloadsGraphCanvas, hourlyDownloadsToChart, granularity, showEpisodeMarkers ? hourMarkers : undefined);
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

        downloadsGraphPreviousButton.disabled = rangeStartHourIndex === 0;
        downloadsGraphRangeSpan.textContent = `${computeRangeDisplay(hours[rangeStartHourIndex])} – ${computeRangeDisplay(hours[rangeEndHourIndex])}`;
        downloadsGraphNextButton.disabled = rangeEndHourIndex === (hours.length - 1);
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

const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' });
const dayAndHourFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'long', day: 'numeric', hour: 'numeric', hour12: true, timeZone: 'UTC' });
const timeOnlyFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' });
const withCommas = new Intl.NumberFormat('en-US');

function computeRangeDisplay(hour: string): string {
    return `${computeMonthName(hour.substring(0, 7))} ${parseInt(hour.substring(8, 10))}`;
}

function computeKeyForGranularity(hour: string, granularity: Granularity): string {
    const [ _, date, hh ] = checkMatches('hour', hour, /^(.*)T(\d{2})$/);
    if (granularity === 'hourly') return `${date}T${hh}:00:00.000Z`;
    if (granularity === 'six-hourly') return `${date}T${(Math.floor(parseInt(hh) / 6) * 6).toString().padStart(2, '0')}:00:00.000Z`;
    if (granularity === 'twelve-hourly') return `${date}T${(Math.floor(parseInt(hh) / 12) * 12).toString().padStart(2, '0')}:00:00.000Z`;
    if (granularity === 'daily') return `${date}T00:00:00.000Z`;
    throw new Error(`Unsupported granularity: ${granularity}`);
}

function computeDownloads(hourlyDownloads: Record<string, number>, granularity: Granularity): Record<string, number> {
    const rt: Record<string, number> = {};
    for (const [ hour, downloads ] of Object.entries(hourlyDownloads)) {
        const key = computeKeyForGranularity(hour, granularity);
        increment(rt, key, downloads);
    }
    return rt;
}

function drawDownloadsChart(canvas: HTMLCanvasElement, hourlyDownloads: Record<string, number>, granularity: Granularity, hourMarkers?: Record<string, unknown>): Chart {
    const hours = Object.keys(hourlyDownloads);
    const downloads = computeDownloads(hourlyDownloads, granularity);
    const hourMarkerPcts = hourMarkers ? Object.keys(hourMarkers).filter(v => hours.includes(v)).map(v => hours.indexOf(v) / hours.length) : undefined;

    const dateFormat = granularity === 'daily' ? dayFormat : dayAndHourFormat;

    const ctx = canvas.getContext('2d')!;

    const labels = Object.keys(downloads);
    const data = {
        labels,
        datasets: [
            {
                data: Object.values(downloads),
                backgroundColor: 'rgba(75, 192, 192, 0.75)',
                hoverBackgroundColor: 'rgba(75, 192, 192, 1)',
                pointRadius: 0,
                borderWidth: 0,
            },
        ]
    };

    const config = {
        type: 'bar',
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
                },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title: (items: TooltipItem<never>[]) => dateFormat.format(new Date(items[0].label)),
                        // deno-lint-ignore no-explicit-any
                        label: (item: any) => `${withCommas.format(item.parsed.y)} download${item.parsed.y === 1 ? '' : 's'}`,
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        // deno-lint-ignore no-explicit-any
                        callback: function(this: any, value: number) {
                            const label = this.getLabelForValue(value);
                            const d = new Date(label);
                            const format = d.getUTCHours() === 0 ? dayFormat : timeOnlyFormat;
                            return format.format(d);
                        }
                    }
                }
            }
        },
        plugins: [
            {
                beforeDraw: (chart: Chart) => {
                    if (!hourMarkerPcts) return;
                    for (const hourMarkerPct of hourMarkerPcts) {
                        const ctx = chart.ctx;
                        const { chartArea } = chart;
                        ctx.beginPath();
                        ctx.strokeStyle = 'rgba(154, 52, 18, 0.75)';
                        const x = chartArea.left + (chart.width * hourMarkerPct);
                        ctx.moveTo(x, chartArea.top);
                        ctx.lineTo(x, chartArea.bottom);
                        ctx.stroke();
                    }
                }
            }
        ]
    };

    // deno-lint-ignore no-explicit-any
    return new Chart(ctx, config as any);
}
