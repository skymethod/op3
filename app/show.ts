import { ApiShowsResponse, ApiShowStatsResponse } from '../worker/routes/api_shows_model.ts';
import { Chart } from './deps.ts';
import { element } from './elements.ts';
import { makeExportDownloads } from './export_downloads.ts';

// provided server-side
declare const initialData: { showObj: ApiShowsResponse, statsObj: ApiShowStatsResponse, times: Record<string, number> };
declare const previewToken: string;

const app = (() => {

    const [ debugDiv ] = [ element('debug') ];

    const { showObj, statsObj, times } = initialData;
    const { showUuid } = showObj;
    if (typeof showUuid !== 'string') throw new Error(`Bad showUuid: ${JSON.stringify(showUuid)}`);

    const hourMarkers = Object.fromEntries(Object.entries(statsObj.episodeFirstHours).map(([episodeId, hour]) => [hour, episodeId]));
    drawDownloadsChart('show-downloads', statsObj.hourlyDownloads, hourMarkers);
    let n = 1;
    for (const episode of showObj.episodes) {
        const episodeHourlyDownloads = statsObj.episodeHourlyDownloads[episode.id];
        if (!episodeHourlyDownloads) continue;
        drawDownloadsChart(`episode-${n}-downloads`, episodeHourlyDownloads);
        n++;
        if (n > 4) break;
    }

    const exportDownloads = makeExportDownloads({ showUuid, previewToken });

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
        labels: labels,
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
        data: data,
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
