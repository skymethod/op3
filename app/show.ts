import { ApiShowsResponse, ApiShowStatsResponse } from '../worker/routes/api_shows_model.ts';
import { Chart } from './deps.ts';
import { element } from './elements.ts';
import { makeExportDownloads } from './export_downloads.ts';

// provided server-side
declare const initialData: { showObj: ApiShowsResponse, statsObj: ApiShowStatsResponse, times: Record<string, number> };
declare const previewToken: string;

const app = (() => {

    const [ debugDiv, sevenDayDownloadsDiv, sevenDayDownloadsSparklineCanvas, thirtyDayDownloadsDiv, thirtyDayDownloadsSparklineCanvas ] = [
        element('debug'),
        element('seven-day-downloads'),
        element<HTMLCanvasElement>('seven-day-downloads-sparkline'),
        element('thirty-day-downloads'),
        element<HTMLCanvasElement>('thirty-day-downloads-sparkline'),
    ];

    const { showObj, statsObj, times } = initialData;
    const { showUuid } = showObj;
    if (typeof showUuid !== 'string') throw new Error(`Bad showUuid: ${JSON.stringify(showUuid)}`);

    const { episodeFirstHours, hourlyDownloads } = statsObj;
    const hourMarkers = Object.fromEntries(Object.entries(episodeFirstHours).map(([ episodeId, hour ]) => [ hour, episodeId ]));
    drawDownloadsChart('show-downloads', hourlyDownloads, hourMarkers);
    let n = 1;
    for (const episode of showObj.episodes) {
        const episodeHourlyDownloads = statsObj.episodeHourlyDownloads[episode.id];
        if (!episodeHourlyDownloads) continue;
        drawDownloadsChart(`episode-${n}-downloads`, episodeHourlyDownloads);
        n++;
        if (n > 4) break;
    }

    const exportDownloads = makeExportDownloads({ showUuid, previewToken });

    const f = new Intl.NumberFormat('en-US');
    const sevenDayDownloads = computeHourlyNDayDownloads(7, hourlyDownloads);
    sevenDayDownloadsDiv.textContent = f.format(Object.values(sevenDayDownloads).at(-1)!);
    drawSparkline(sevenDayDownloadsSparklineCanvas, sevenDayDownloads);
    const thirtyDayDownloads = computeHourlyNDayDownloads(30, hourlyDownloads);
    thirtyDayDownloadsDiv.textContent = f.format(Object.values(thirtyDayDownloads).at(-1)!);
    drawSparkline(thirtyDayDownloadsSparklineCanvas, thirtyDayDownloads);

    debugDiv.textContent = Object.entries(times).map(v => v.join(': ')).join('\n')
    console.log(initialData);

    function update() {
        exportDownloads.update();
    }

    return { update };
})();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    app.update();
});

//

function drawDownloadsChart(id: string, hourlyDownloads: Record<string, number>, hourMarkers?: Record<string, unknown>,) {
    const maxDownloads = Math.max(...Object.values(hourlyDownloads));
    const markerData = Object.keys(hourlyDownloads).map(v => {
        if (hourMarkers && hourMarkers[v]) return maxDownloads;
        return undefined;
    });

    const ctx = (document.getElementById(id) as HTMLCanvasElement).getContext('2d')!;

    const labels = Object.keys(hourlyDownloads);
    const data = {
        labels,
        datasets: [
            {
                data: Object.values(hourlyDownloads),
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                pointRadius: 0,
                borderWidth: 1,
            },
            {
                type: 'bar',
                data: markerData,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)'
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
            },
            plugins: {
                legend: {
                    display: false,
                }
            }
        }
    };

    // deno-lint-ignore no-explicit-any
    new Chart(ctx, config as any);
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

function drawSparkline(canvas: HTMLCanvasElement, labelsAndValues: Record<string, number>) {
    const ctx = canvas.getContext('2d')!;

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
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
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
            animation: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    enabled: false,
                }
            }
        }
    };

    // deno-lint-ignore no-explicit-any
    new Chart(ctx, config as any);
}

