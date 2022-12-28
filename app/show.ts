import { ApiShowsResponse, ApiShowStatsResponse, EpisodeInfo } from '../worker/routes/api_shows_model.ts';
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, LineController, LineElement, PointElement, TimeScale, Tooltip } from './deps.ts';
import { makeDownloadsGraph } from './downloads_graph.ts';
import { element } from './elements.ts';
import { makeEpisodePacing } from './episode_pacing.ts';
import { makeExportDownloads } from './export_downloads.ts';
import { makeHeadlineStats } from './headline_stats.ts';
import { makeTopCountries } from './top_countries.ts';

// provided server-side
declare const initialData: { showObj: ApiShowsResponse, statsObj: ApiShowStatsResponse, times: Record<string, number> };
declare const previewToken: string;

const app = (() => {

    Chart.register(TimeScale);
    Chart.register(Tooltip);
    Chart.register(CategoryScale);
    Chart.register(LinearScale);
    Chart.register(LineController);
    Chart.register(PointElement);
    Chart.register(LineElement);
    Chart.register(BarController);
    Chart.register(BarElement);
    Chart.register(Legend);

    const [ debugDiv ] = [
        element('debug'),
    ];

    const { showObj, statsObj, times } = initialData;
    const { showUuid, episodes } = showObj;
    if (typeof showUuid !== 'string') throw new Error(`Bad showUuid: ${JSON.stringify(showUuid)}`);

    const { episodeFirstHours, hourlyDownloads, dailyFoundAudience, episodeHourlyDownloads, monthlyCountryDownloads } = statsObj;
    const episodeMarkers: Record<string, EpisodeInfo> = Object.fromEntries(Object.entries(episodeFirstHours).map(([ episodeId, hour ]) => [ hour, showObj.episodes.find(v => v.id === episodeId)! ]));

    const debug = new URLSearchParams(document.location.search).has('debug');

    if (debug) {
        debugDiv.textContent = Object.entries(times).map(v => v.join(': ')).join('\n')
    } else {
        debugDiv.style.display = 'none';
    }
    const headlineStats = makeHeadlineStats({ hourlyDownloads, dailyFoundAudience });
    makeDownloadsGraph({ hourlyDownloads, episodeMarkers, debug });
    const exportDownloads = makeExportDownloads({ showUuid, previewToken });
    makeEpisodePacing({ episodeHourlyDownloads, episodes });
    makeTopCountries({ monthlyCountryDownloads });

    console.log(initialData);

    function update() {
        exportDownloads.update();
        headlineStats.update();
    }

    return { update };
})();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    app.update();
});
