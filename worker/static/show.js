
function drawDownloadsChart(id, hourlyDownloads, hourMarkers) {
    const maxDownloads = Math.max(...Object.values(hourlyDownloads));
    const markerData = Object.keys(hourlyDownloads).map(v => {
        if (hourMarkers && hourMarkers[v]) return maxDownloads;
        return undefined;
    });

    const ctx = document.getElementById(id).getContext('2d');

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

    new Chart(ctx, config);
}

async function download(showUuid, month) {
    const parts = [];
    let continuationToken;
    while (true) {
        const u = new URL(`/api/1/downloads/show/${showUuid}`, document.location);
        const qp = new URLSearchParams(document.location.search);
        if (qp.has('ro')) u.searchParams.set('ro', 'true');
        u.searchParams.set('start', month);
        u.searchParams.set('limit', '20000');
        u.searchParams.set('token', previewToken);
        if (continuationToken) {
            u.searchParams.set('continuationToken', continuationToken);
            u.searchParams.set('skip', 'headers');
        }
        console.log(`fetch continuationToken=${continuationToken}`);
        const res = await fetch(u.toString());
        if (res.status !== 200) throw new Error(`Unexpected status: ${res.status}`);
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
        [ 'debug', 'download-link' ].map(v => document.getElementById(v));

    const { showObj, statsObj, times } = initialData;
    const { showUuid } = showObj;

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

    downloadLinkAnchor.onclick = async () => await download(showUuid, '2022-12');

    function update() {
        debugDiv.textContent = Object.entries(times).map(v => v.join(': ')).join('\n')
        console.log(initialData);
    }

    return { update };
})();

globalThis.updateApp = () => app.update();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
