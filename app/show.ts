import { ApiShowsResponse, ApiShowStatsResponse } from '../worker/routes/api_shows_model.ts';
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, LineController, LineElement, PointElement, TimeScale, Tooltip, sortBy } from './deps.ts';
import { makeDownloadsGraph } from './downloads_graph.ts';
import { element } from './elements.ts';
import { makeEpisodePacing } from './episode_pacing.ts';
import { makeExportDownloads } from './export_downloads.ts';
import { makeHeadlineStats } from './headline_stats.ts';
import { makeTopCountries } from './top_countries.ts';
import { makeTopApps } from './top_apps.ts';
import { makeTopDevices } from './top_devices.ts';
import { makeTopDeviceTypes } from './top_device_types.ts';
import { makeTopBrowserDownloads } from './top_browser_downloads.ts';
import { makeTopMetros } from './top_metros.ts';
import { addHoursToHourString, addMonthsToMonthString } from '../worker/timestamp.ts';
import { makeFooter } from './footer.ts';
import { makeTopEuRegions } from './top_eu_regions.ts';
import { makeTopAuRegions } from './top_au_regions.ts';
import { makeTopCaRegions } from './top_ca_regions.ts';
import { makeTopAsRegions } from './top_as_regions.ts';
import { makeTopLatamRegions } from './top_latam_regions.ts';
import { makeListens } from './listens.ts';

// provided server-side
declare const initialData: { showObj: ApiShowsResponse, statsObj: ApiShowStatsResponse, times: Record<string, number>, lang?: string };
declare const previewToken: string;
declare const strings: Record<string, string>;

const app = await (async () => {

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

    console.log(initialData);

    const { showObj, statsObj, times, lang } = initialData;
    const { showUuid, episodes = [], title: showTitle } = showObj;
    if (typeof showUuid !== 'string') throw new Error(`Bad showUuid: ${JSON.stringify(showUuid)}`);

    const grabMoreDataIfNecessary = async (page: 'first' | 'all') => {
        const { episodeHourlyDownloads, months } = statsObj;
        let changed = false;
        try {
            let needMonth: string | undefined;
            let epsByPubdate = sortBy(episodes, v => v.pubdate ?? '1970').reverse();
            if (page === 'first') epsByPubdate = epsByPubdate.slice(0, 8);
            for (const ep of epsByPubdate) {
                const firstHour = statsObj.episodeFirstHours[ep.id];
                if (firstHour) {
                    const month = firstHour.substring(0, 7);
                    needMonth = needMonth === undefined ? month : month < needMonth ? month : needMonth;
                }
            }
            let haveMonth = statsObj.months[0];
            console.log(JSON.stringify({ page, haveMonth, needMonth }));
            if (needMonth === undefined) return changed;
            if (months.includes(needMonth)) return changed;
            const moreMonths: string[] = [];
            let grabs = 0;
            while (grabs < 10) {
                if (!haveMonth) return changed;
                if (moreMonths.includes(needMonth)) return changed;
                const latestMonth = addMonthsToMonthString(haveMonth, -1);

                const qp = new URLSearchParams(document.location.search);
                const u = new URL(`/api/1/shows/${showUuid}/stats`, document.location.href);
                if (qp.has('ro')) u.searchParams.set('ro', 'true');
                u.searchParams.set('token', previewToken);
                u.searchParams.set('overall', 'stub');
                u.searchParams.set('latestMonth', latestMonth);
                const lookbackMonths = 2;
                u.searchParams.set('lookbackMonths', lookbackMonths.toString());
                console.log(`grab more show stats: ${JSON.stringify({ latestMonth, lookbackMonths })}`);
                const res = await fetch(u.toString());
                if (res.status !== 200) throw new Error(`Unexpected status: ${res.status} ${await res.text()}`);

                const moreStats = await res.json() as ApiShowStatsResponse;
                for (const [ episodeId, hourlyDownloads ] of Object.entries(moreStats.episodeHourlyDownloads)) {
                    const merged = { ...hourlyDownloads, ...episodeHourlyDownloads[episodeId] };
                    episodeHourlyDownloads[episodeId] = merged;
                }
                changed = true;
                haveMonth = moreStats.months[0];
                moreMonths.push(...moreStats.months);
                grabs++;
            }
        } finally {
            if (page === 'first') {
                // signal page ready to show
                class DataLoaded extends HTMLElement {}
                customElements.define('data-loaded', DataLoaded);
            }
        }
        return changed;
    }
    await grabMoreDataIfNecessary('first');

    const { episodeFirstHours, dailyFoundAudience, monthlyDimensionDownloads, episodeListens, knownAppLinks } = statsObj;
    const hourlyDownloads = insertZeros(statsObj.hourlyDownloads);
    const episodeHourlyDownloads = Object.fromEntries(Object.entries(statsObj.episodeHourlyDownloads).map(v => [ v[0], insertZeros(v[1]) ]));
    const episodesWithFirstHours = Object.entries(episodeFirstHours).map(([ episodeId, firstHour ]) => ({ firstHour, ...episodes.find(v => v.id === episodeId)! }));
    const showSlug = computeShowSlug(showTitle);
    const debug = new URLSearchParams(document.location.search).has('debug');
    const mostRecentDate = Object.keys(hourlyDownloads).at(-1)?.substring(0, 10);

    if (debug) {
        debugDiv.textContent = Object.entries(times).map(v => v.join(': ')).join('\n')
    } else {
        debugDiv.style.display = 'none';
    }

    const headlineStats = makeHeadlineStats({ hourlyDownloads, dailyFoundAudience, strings, lang });
    makeDownloadsGraph({ hourlyDownloads, episodes: episodesWithFirstHours, episodeHourlyDownloads, debug, strings, lang });
    const exportDownloads = makeExportDownloads({ showUuid, showSlug, previewToken, strings, lang });
    const shot = new URLSearchParams(document.location.search).has('shot');
    const { updateEpisodeHourlyDownloads } = makeEpisodePacing({ episodeHourlyDownloads, episodes, showTitle, showSlug, mostRecentDate, shot, strings, lang });

    makeListens({ episodeListens, episodes, knownAppLinks, debug, strings });
    
    const downloadsPerMonth = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([ month, v ]) => ([ month, Object.values(v['countryCode'] ?? {}).reduce((a, b) => a + b, 0) ])));

    makeTopCountries({ showSlug, monthlyDimensionDownloads, strings, lang });
    makeTopApps({ showSlug, monthlyDimensionDownloads, strings, lang });
    makeTopDevices({ showSlug, monthlyDimensionDownloads, strings, lang });
    makeTopDeviceTypes({ showSlug, monthlyDimensionDownloads, strings, lang });
    makeTopBrowserDownloads({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang });
    makeTopMetros({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang });
    makeTopCaRegions({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang });
    makeTopEuRegions({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang });
    makeTopAuRegions({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang });
    makeTopAsRegions({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang });
    makeTopLatamRegions({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings, lang });
    makeFooter({ mostRecentDate, strings, lang });

    const langParam = new URL(document.location.href).searchParams.get('lang') ?? undefined;
    if (langParam) {
        const localized = document.querySelectorAll<HTMLAnchorElement>('a.localized');
        for (const a of localized) {
            const u = new URL(a.href);
            u.searchParams.set('lang', langParam);
            a.href = u.toString();
        }
    }

    function update() {
        exportDownloads.update();
        headlineStats.update();
    }

    (async () => {
        if (shot) return;
        const changed = await grabMoreDataIfNecessary('all');
        updateEpisodeHourlyDownloads(changed ? Object.fromEntries(Object.entries(statsObj.episodeHourlyDownloads).map(v => [ v[0], insertZeros(v[1]) ])) : undefined, true);
    })();

    return { update };
})();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    app.update();
});

function insertZeros(hourlyDownloads: Record<string, number>): Record<string, number> {
    const hours = Object.keys(hourlyDownloads)
    if (hours.length < 2) return hourlyDownloads;
    const maxHour = hours.at(-1)!;
    let hour = hours[0];
    const rt: Record<string, number>  = {};
    while (hour <= maxHour) {
        rt[hour] = hourlyDownloads[hour] ?? 0;
        hour = addHoursToHourString(hour, 1);
    }
    return rt;
}

function computeShowSlug(title: string | undefined): string {
    return (title ?? 'untitled').toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').replaceAll(/\s+/g, ' ').trim().replaceAll(' ', '-');
}
