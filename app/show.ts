import { ApiShowsResponse, ApiShowStatsResponse } from '../worker/routes/api_shows_model.ts';
import { Chart } from './deps.ts';

// provided server-side
declare const initialData: { showObj: ApiShowsResponse, statsObj: ApiShowStatsResponse, times: Record<string, number> };
declare const previewToken: string;

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

async function download(e: Event, showUuid: string, month: string) {
    e.preventDefault();
    
    const parts = [];
    let continuationToken;
    const qp = new URLSearchParams(document.location.search);
    while (true) {
        const u = new URL(`/api/1/downloads/show/${showUuid}`, document.location.href);
        if (qp.has('ro')) u.searchParams.set('ro', 'true');
        const limit = qp.get('limit') ?? '20000';
        u.searchParams.set('start', month);
        u.searchParams.set('limit', limit);
        u.searchParams.set('token', previewToken);
        if (continuationToken) {
            u.searchParams.set('continuationToken', continuationToken);
            u.searchParams.set('skip', 'headers');
        }
        console.log(`fetch limit=${limit} continuationToken=${continuationToken}`);
        const res = await fetch(u.toString());
        if (res.status !== 200) throw new Error(`Unexpected status: ${res.status} ${await res.text()}`);
        const blob = await res.blob();
        parts.push(blob);
        continuationToken = res.headers.get('x-continuation-token');
        if (typeof continuationToken !== 'string') break;
    }
    const { type } = parts[0];
    const blob = new Blob(parts, { type });

    const blobUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.target = '_blank';
    anchor.download = `downloads-${month}.tsv`;
    anchor.click();

    URL.revokeObjectURL(blobUrl);
}

const app = (() => {

    const [ debugDiv, downloadLinkAnchor ] =
        [ 'debug', 'download-link' ].map(v => document.getElementById(v)!);

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

    downloadLinkAnchor.onclick = async e => await download(e, showUuid, '2022-12');

    function update() {
        debugDiv.textContent = Object.entries(times).map(v => v.join(': ')).join('\n')
        console.log(initialData);
    }

    return { update };
})();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    app.update();
});
