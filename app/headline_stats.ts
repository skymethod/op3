import { Chart } from './deps.ts';
import { element } from './elements.ts';
import { increment } from '../worker/summaries.ts';

type Opts = { hourlyDownloads: Record<string, number>, dailyFoundAudience: Record<string, number> };

export const makeHeadlineStats = ({ hourlyDownloads, dailyFoundAudience }: Opts) => {

    const [ 
        sevenDayDownloadsDiv, sevenDayDownloadsAsofSpan, sevenDayDownloadsSparklineCanvas, 
        thirtyDayDownloadsDiv, thirtyDayDownloadsAsofSpan, thirtyDayDownloadsSparklineCanvas, 
        audienceCountDiv, audiencePeriodDiv, audienceMinigraph,
    ] = [
        element('seven-day-downloads'),
        element('seven-day-downloads-asof'),
        element<HTMLCanvasElement>('seven-day-downloads-sparkline'),
        element('thirty-day-downloads'),
        element('thirty-day-downloads-asof'),
        element<HTMLCanvasElement>('thirty-day-downloads-sparkline'),
        element('audience-count'),
        element('audience-period'),
        element<HTMLCanvasElement>('audience-minigraph'),
    ];

    initDownloadsBox(7, hourlyDownloads, sevenDayDownloadsDiv, sevenDayDownloadsAsofSpan, sevenDayDownloadsSparklineCanvas);
    initDownloadsBox(30, hourlyDownloads, thirtyDayDownloadsDiv, thirtyDayDownloadsAsofSpan, thirtyDayDownloadsSparklineCanvas);
    initAudienceBox(dailyFoundAudience, audienceCountDiv, audiencePeriodDiv, audienceMinigraph);

    function update() {
       
    }

    update();

    return { update };
};

//

const withCommas = new Intl.NumberFormat('en-US');

function initDownloadsBox(n: number, hourlyDownloads: Record<string, number>, valueDiv: HTMLElement, asofSpan: HTMLElement, sparklineCanvas: HTMLCanvasElement) {
    const asofFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' });

    const nDayDownloads = computeHourlyNDayDownloads(n, hourlyDownloads);
    const init = () => {
        valueDiv.textContent = withCommas.format(Object.values(nDayDownloads).at(-1)!);
        asofSpan.textContent = asofFormat.format(new Date(`${Object.keys(nDayDownloads).at(-1)!.substring(0, 10)}T00:00:00.000Z`));
    };
    init();
    drawSparkline(sparklineCanvas, nDayDownloads, { onHover: v => {
        if (v) {
            valueDiv.textContent = withCommas.format(Math.round(v.value));
            asofSpan.textContent = asofFormat.format(new Date(`${v.label.substring(0, 10)}T00:00:00.000Z`));
        } else {
            init();
        }
    }});
}

function computeHourlyNDayDownloads(n: number, hourlyDownloads: Record<string, number>): Record<string, number> {
    const buffer: number[] = [];
    const rt: Record<string, number> = {};
    const bufferSize = n * 24;
    for (const [ hour, downloads ] of Object.entries(hourlyDownloads)) {
        buffer.push(downloads);
        if (buffer.length > bufferSize) buffer.shift();
        if (buffer.length === bufferSize) {
            rt[hour] = buffer.reduce((a, b) => a + b, 0);
        }
    }
    return rt;
}

function drawSparkline(canvas: HTMLCanvasElement, labelsAndValues: Record<string, number>, { onHover }: { onHover?: (opts?: { label: string, value: number }) => void } = {}) {
    const ctx = canvas.getContext('2d')!;

    const entries = Object.entries(labelsAndValues);
    const values = Object.values(labelsAndValues);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const labels = Object.keys(labelsAndValues);
    const data = {
        labels,
        datasets: [
            {
                data: values,
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                pointRadius: 0,
                borderWidth: 1,
            },
        ]
    };

    const config = {
        type: 'line',
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
            interaction: {
                intersect: false,
                mode: 'index',
            },
            animation: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    enabled: false,
                    backgroundColor: 'transparent',
                    caretSize: 0,
                    padding: 0,
                    titleFont: {
                        style: 'normal',
                        weight: 'normal',
                        size: 12,
                        lineHeight: 1,
                    },
                    titleSpacing: 0,
                    titleMarginBottom: 30,
                    callbacks: {
                        label: () => '', /* only use the title */
                    }
                },
            },
        },
        plugins: [{
            id: 'event-catcher',
            // deno-lint-ignore no-explicit-any
            beforeEvent(_chart: unknown, args: any, _pluginOptions: unknown) {
                if (args.event.type === 'mouseout' && onHover) {
                    onHover();
                }
            }
          }]
    };

    // deno-lint-ignore no-explicit-any
    const chart = new Chart(ctx, config as any);

    if (onHover) {
        chart.options.onHover = (e) => {
            // deno-lint-ignore no-explicit-any
            const points = chart.getElementsAtEventForMode(e as any, 'index', { intersect: false }, true);
            if (points.length > 0) {
                const { index } = points[0];
                const [ label, value ] = entries[index];
                onHover({ label, value });
            }
        };
    }
}

//

function initAudienceBox(dailyFoundAudience: Record<string, number>, audienceCountDiv: HTMLElement, audiencePeriodDiv: HTMLElement, audienceMinigraph: HTMLCanvasElement) {
    const monthlyAudience: Record<string, number> = {};
    for (const [ date, count ] of Object.entries(dailyFoundAudience)) {
        const month = date.substring(0, 7);
        increment(monthlyAudience, month, count);
    }
    console.log(monthlyAudience);
    const [ lastMonth, lastMonthAudience ] = Object.entries(monthlyAudience).at(-2)!;
    const thisMonth = Object.keys(monthlyAudience).at(-1);
    audienceCountDiv.textContent = withCommas.format(lastMonthAudience);
    audiencePeriodDiv.textContent = `in ${computeMonthName(lastMonth)}`;
    drawMinigraph(audienceMinigraph, monthlyAudience, { onHover: v => {
        const { label, value } = v ?? { label: lastMonth, value: lastMonthAudience };
        audienceCountDiv.textContent = withCommas.format(value);
        audiencePeriodDiv.textContent = `in ${computeMonthName(label)}${label === thisMonth ? ' (so far)' : ''}`;
    }});
}

function computeMonthName(month: string): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01`));
}

function drawMinigraph(canvas: HTMLCanvasElement, labelsAndValues: Record<string, number>, { onHover }: { onHover?: (opts?: { label: string, value: number }) => void } = {}) {
    const ctx = canvas.getContext('2d')!;

    const entries = Object.entries(labelsAndValues);
    const values = Object.values(labelsAndValues);
    const minValue = 0;
    const maxValue = Math.max(...values);
    const labels = Object.keys(labelsAndValues);
    const data = {
        labels,
        datasets: [
            {
                data: values,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                pointRadius: 0,
                borderWidth: 1,
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
            interaction: {
                intersect: false,
                mode: 'index',
            },
            animation: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    enabled: false,
                    backgroundColor: 'transparent',
                    caretSize: 0,
                    padding: 0,
                    titleFont: {
                        style: 'normal',
                        weight: 'normal',
                        size: 12,
                        lineHeight: 1,
                    },
                    titleSpacing: 0,
                    titleMarginBottom: 30,
                    callbacks: {
                        label: () => '', /* only use the title */
                    }
                },
            },
        },
        plugins: [{
            id: 'event-catcher',
            // deno-lint-ignore no-explicit-any
            beforeEvent(_chart: unknown, args: any, _pluginOptions: unknown) {
                if (args.event.type === 'mouseout' && onHover) {
                    onHover();
                }
            }
          }]
    };

    // deno-lint-ignore no-explicit-any
    const chart = new Chart(ctx, config as any);

    if (onHover) {
        chart.options.onHover = (e) => {
            // deno-lint-ignore no-explicit-any
            const points = chart.getElementsAtEventForMode(e as any, 'index', { intersect: false }, true);
            if (points.length > 0) {
                const { index } = points[0];
                const [ label, value ] = entries[index];
                onHover({ label, value });
            }
        };
    }
}