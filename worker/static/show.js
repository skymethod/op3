
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

const app = (() => {

    const [debugDiv] =
        ['debug'].map(v => document.getElementById(v));

    const { showObj, statsObj, times } = initialData;

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
