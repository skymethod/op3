import { Chart, replacePlaceholders } from './deps.ts';
import { element } from './elements.ts';
import { increment } from '../worker/summaries.ts';
import { computeMonthName, getNumberFormat } from './util.ts';

type Opts = { hourlyDownloads: Record<string, number>, dailyFoundAudience: Record<string, number>, strings: Record<string, string>, lang: string | undefined };

export const makeHeadlineStats = ({ hourlyDownloads, dailyFoundAudience, strings, lang }: Opts) => {

    const [ 
        sevenDayDownloadsDiv, sevenDaySpacerLine, sevenDayDownloadsAsofSpan, sevenDayDownloadsSparklineCanvas, 
        thirtyDayDownloadsDiv, thirtyDayDownloadsAsofSpan, thirtyDayDownloadsSparklineCanvas, 
        downloadsCountDiv, downloadsPeriodDiv, downloadsSpacerLine, downloadsMinigraph,
        audienceCountDiv, audiencePeriodDiv, audienceSpacerLine, audienceMinigraph,
    ] = [
        element('seven-day-downloads'),
        element('seven-day-spacer-line'),
        element('seven-day-downloads-asof'),
        element<HTMLCanvasElement>('seven-day-downloads-sparkline'),
        element('thirty-day-downloads'),
        element('thirty-day-downloads-asof'),
        element<HTMLCanvasElement>('thirty-day-downloads-sparkline'),
        element('downloads-count'),
        element('downloads-period'),
        element('downloads-spacer-line'),
        element<HTMLCanvasElement>('downloads-minigraph'),
        element('audience-count'),
        element('audience-period'),
        element('audience-spacer-line'),
        element<HTMLCanvasElement>('audience-minigraph'),
    ];

    initDownloadsBox(7, hourlyDownloads, sevenDayDownloadsDiv, sevenDaySpacerLine,  sevenDayDownloadsAsofSpan, sevenDayDownloadsSparklineCanvas, lang);
    initDownloadsBox(30, hourlyDownloads, thirtyDayDownloadsDiv, undefined, thirtyDayDownloadsAsofSpan, thirtyDayDownloadsSparklineCanvas, lang);

    const monthlyDownloadsBox = initMonthlyBox(computeMonthlyCounts(hourlyDownloads), downloadsCountDiv, downloadsPeriodDiv, downloadsSpacerLine, downloadsMinigraph, strings, lang);
    const monthlyAudienceBox = initMonthlyBox(computeMonthlyCounts(dailyFoundAudience), audienceCountDiv, audiencePeriodDiv, audienceSpacerLine, audienceMinigraph, strings, lang);
    monthlyDownloadsBox.addHoverListener(monthlyAudienceBox.onHoverMonth);
    monthlyAudienceBox.addHoverListener(monthlyDownloadsBox.onHoverMonth);

    function update() {
       
    }

    update();

    return { update };
};

//

function initDownloadsBox(n: number, hourlyDownloads: Record<string, number>, valueDiv: HTMLElement, spacerLine: HTMLElement | undefined,  asofSpan: HTMLElement, sparklineCanvas: HTMLCanvasElement, lang: string | undefined) {
    const locale = lang ?? 'en-US';
    const asofFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' });

    if (spacerLine && lang === 'nl') spacerLine.classList.remove('hidden');

    const nDayDownloads = computeHourlyNDayDownloads(n, hourlyDownloads);

    if (Object.keys(nDayDownloads).length === 0) {
        valueDiv.textContent = getNumberFormat(lang).format(Object.values(hourlyDownloads).reduce((a, b) => a + b, 0));
        asofSpan.textContent = Object.keys(hourlyDownloads).length === 0 ? '' : asofFormat.format(new Date(`${Object.keys(hourlyDownloads).at(-1)!.substring(0, 10)}T00:00:00.000Z`));
        return;
    }
    const init = () => {
        valueDiv.textContent = getNumberFormat(lang).format(Object.values(nDayDownloads).at(-1)!);
        asofSpan.textContent = asofFormat.format(new Date(`${Object.keys(nDayDownloads).at(-1)!.substring(0, 10)}T00:00:00.000Z`));
    };
    init();
    drawSparkline(sparklineCanvas, nDayDownloads, { onHover: v => {
        if (v) {
            valueDiv.textContent = getNumberFormat(lang).format(Math.round(v.value));
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

function computeMonthlyCounts(dateBasedCounts: Record<string, number>): Record<string, number> {
    const monthlyCounts: Record<string, number> = {};
    for (const [ date, count ] of Object.entries(dateBasedCounts)) {
        const month = date.substring(0, 7);
        increment(monthlyCounts, month, count);
    }
    return monthlyCounts;
}

type HoverMonthHandler = (hoverMonth?: string) => void;
type MonthlyBox = { onHoverMonth: HoverMonthHandler, addHoverListener: (handler: HoverMonthHandler) => void };

function initMonthlyBox(monthlyCounts: Record<string, number>, countDiv: HTMLElement, periodDiv: HTMLElement, spacerLine: HTMLElement, minigraph: HTMLCanvasElement, strings: Record<string, string>, lang: string | undefined): MonthlyBox {
    const [ lastMonth, lastMonthCount ] = Object.entries(monthlyCounts).at(-2) ?? [ '', 0 ];
    const [ thisMonth, thisMonthCount ] = Object.entries(monthlyCounts).at(-1) ?? [ '', 0 ];
    const initialMonth = lastMonthCount > thisMonthCount ? lastMonth : thisMonth;

    if (lang === 'fr' || lang === 'nl') spacerLine.classList.remove('hidden');

    const hoverListeners: HoverMonthHandler[] = [];
    const onHoverMonth: HoverMonthHandler = hoverMonth => {
        const month = hoverMonth ?? initialMonth;
        const value = monthlyCounts[month];
        countDiv.textContent = getNumberFormat(lang).format(value);
        periodDiv.textContent = `${replacePlaceholders(strings.in_month, [ [ 'month', computeMonthName(month, lang) ] ])}${month === thisMonth ? ` (${strings.so_far})` : ''}`;
    }
    if (initialMonth !== '') onHoverMonth(initialMonth);
    drawMinigraph(minigraph, monthlyCounts, { onHover: v => {
        onHoverMonth(v?.label);
        hoverListeners.forEach(w => w(v?.label));
    }});
    return { onHoverMonth, addHoverListener: v => hoverListeners.push(v)};
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
