import { timed } from '../async.ts';
import { AudienceSummary, computeAudienceSummaryKey, isValidAudienceSummary } from '../backend/audience.ts';
import { Blobs } from '../backend/blobs.ts';
import { ShowListenStats, computeShowListenStatsKey, isValidShowListenStats } from '../backend/listens.ts';
import { isEpisodeRecord, isFeedRecord } from '../backend/show_controller_model.ts';
import { ShowSummary, computeShowSummaryKey, isValidShowSummary } from '../backend/show_summaries.ts';
import { check, checkMatches, isString, isValidMonth } from '../check.ts';
import { compareByDescending } from '../collections.ts';
import { Configuration } from '../configuration.ts';
import { Bytes, decodeXml } from '../deps.ts';
import { DoNames } from '../do_names.ts';
import { packError } from '../errors.ts';
import { SHOW_UUID_REDIRECTS } from '../redirects.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { RpcClient } from '../rpc_model.ts';
import { increment, total } from '../summaries.ts';
import { addMonthsToMonthString } from '../timestamp.ts';
import { isValidUuid } from '../uuid.ts';
import { ApiShowsResponse, ApiShowStatsResponse, ApiShowSummaryStatsResponse, EpisodeInfo } from './api_shows_model.ts';

type LookupShowIdOpts = Omit<ShowsOpts, 'method' | 'origin'>;

export async function lookupShowId({ showUuidOrPodcastGuidOrFeedUrlBase64, searchParams, rpcClient, roRpcClient, configuration, times = {} }: LookupShowIdOpts): Promise<{ showUuid: string, showUuidInput: string } | Response> {
    let showUuid: string;
    let showUuidInput: string;
    try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(showUuidOrPodcastGuidOrFeedUrlBase64)) {
            const result = await timed(times, 'lookup-show-uuid-for-podcast-guid', () => lookupShowUuidForPodcastGuid(showUuidOrPodcastGuidOrFeedUrlBase64.toLowerCase(), { rpcClient, roRpcClient, searchParams }));
            if (!result) return newJsonResponse({ message: 'not found' }, 404);
            showUuidInput = result;
        } else if (isValidUuid(showUuidOrPodcastGuidOrFeedUrlBase64)) {
            showUuidInput = showUuidOrPodcastGuidOrFeedUrlBase64;
        } else if (/^[0-9a-zA-Z_-]{15,}=*$/i.test(showUuidOrPodcastGuidOrFeedUrlBase64)) {
            const feedUrl = Bytes.ofBase64(showUuidOrPodcastGuidOrFeedUrlBase64, { urlSafe: true }).utf8();
            if (feedUrl.includes('\r') || feedUrl.includes('\n') || feedUrl.trim() !== feedUrl || !/^http/i.test(feedUrl.trim())) throw new Error(`Invalid feedUrl: ${JSON.stringify(feedUrl)}`);
            const result = await timed(times, 'lookup-show-uuid-for-feed-url', () => lookupShowUuidForFeedUrl(feedUrl, { rpcClient, roRpcClient, searchParams }));
            if (!result) return newJsonResponse({ message: 'not found' }, 404);
            showUuidInput = result;
        } else {
            throw new Error(`Provide a showUuid, podcastGuid, or feedUrlBase64`);
        }
        check('showUuid', showUuidInput, isValidUuid);
        showUuid = await computeUnderlyingShowUuid(showUuidInput, configuration);
        check('showUuid', showUuid, isValidUuid);
    } catch (e) {
        const { message } = packError(e);
        return newJsonResponse({ message }, 400);
    }
    return { showUuid, showUuidInput };
}

type ShowsOpts = { showUuidOrPodcastGuidOrFeedUrlBase64: string, method: string, searchParams: URLSearchParams, rpcClient: RpcClient, roRpcClient?: RpcClient, times?: Record<string, number>, configuration: Configuration, origin: string };

export async function computeShowsResponse(opts: ShowsOpts): Promise<Response> {
    const { method, searchParams, rpcClient, roRpcClient, times = {}, origin } = opts;
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
  
    const lookupResult = await lookupShowId(opts);
    if (lookupResult instanceof Response) return lookupResult;
    const { showUuid, showUuidInput } = lookupResult;

    const targetRpcClient = searchParams.has('ro') ? roRpcClient : rpcClient;
    if (!targetRpcClient) throw new Error(`Need rpcClient`);

    const episodesParam = searchParams.get('episodes') ?? undefined;
    if (typeof episodesParam === 'string' && !/^include|exclude$/.test(episodesParam)) return newJsonResponse({ message: `Bad episodes: ${episodesParam}, expected 'include' or 'exclude'` }, 400);
    const includeEpisodes = episodesParam === 'include';

    const [ selectShowResponse, selectEpisodesResponse ] = await timed(times, 'select-show+select-episodes', () => Promise.all([
        timed(times, 'select-show', () => targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/shows/${showUuid}` }, DoNames.showServer)),
        includeEpisodes ? timed(times, 'select-episodes', () => targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/shows/${showUuid}/episodes` }, DoNames.showServer)) : Promise.resolve(),
    ]));
    const { results: showRecords = [] } = selectShowResponse;
    if (showRecords.length === 0) return newJsonResponse({ message: 'not found' }, 404);

    const { title, podcastGuid } = showRecords[0] as Record<string, unknown>;
    if (title !== undefined && typeof title !== 'string') throw new Error(`Bad title: ${JSON.stringify(title)}`);
    if (podcastGuid !== undefined && typeof podcastGuid !== 'string') throw new Error(`Bad podcastGuid: ${JSON.stringify(podcastGuid)}`);
    const statsPageUrl = computeStatsPageUrl({ showUuid, origin });

    let episodes: EpisodeInfo[] | undefined;
    if (typeof selectEpisodesResponse === 'object') {
        const { results: episodeRecords = [] } = selectEpisodesResponse;
        episodes = episodeRecords
            .filter(isEpisodeRecord)
            .sort(compareByDescending(r => r.pubdateInstant))
            .map(({ id, title, pubdateInstant, itemGuid }) => ({ id, title: cleanTitle(title), pubdate: pubdateInstant, itemGuid }));
    }

    return newJsonResponse(computeApiShowsResponse(showUuidInput, { showUuid, title, podcastGuid, statsPageUrl, episodes }, origin));
}

type StatsOpts = { showUuid: string, method: string, searchParams: URLSearchParams, statsBlobs?: Blobs, roStatsBlobs?: Blobs, times?: Record<string, number>, configuration: Configuration };

export async function computeShowStatsResponse({ showUuid: showUuidInput, method, searchParams, statsBlobs, roStatsBlobs, times = {}, configuration }: StatsOpts): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    const { showUuid, targetStatsBlobs } = await computeStatsBlobsAndShowUuid({ showUuidInput, searchParams, statsBlobs, roStatsBlobs, configuration });
    const overallParam = searchParams.get('overall') ?? undefined;
    if (overallParam !== undefined) checkMatches('overall', overallParam, /^stub$/);
    const latestMonth = searchParams.get('latestMonth') ?? new Date().toISOString().substring(0, 7);
    check('latestMonth', latestMonth, isValidMonth);
    const lookbackMonthsParam = searchParams.get('lookbackMonths') ?? '2';
    const lookbackMonths = parseInt(checkMatches('lookbackMonths', lookbackMonthsParam, /^[0123]$/)[0]);
    const monthOffsets = [...Array(lookbackMonths + 1).keys()].map(v => -v).reverse(); // 2 = [ -2, -1, 0 ]
    
    const months = monthOffsets.map(v => addMonthsToMonthString(latestMonth, v));
    const monthsTag = `${months.length}mo`;

    const [ overall, monthsSummaries, monthsAudiences, listens ] = await timed(times, `get-overall+get-${monthsTag}-summary+get-${monthsTag}-audience+listens`, () => Promise.all([
        timed(times, 'get-overall', () => overallParam === 'stub' ? Promise.resolve(computeStubShowSummary(showUuid, 'overall')) : targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: 'overall' }), 'json')),
        timed(times, `get-${monthsTag}-summary`, async () => (await Promise.all(months.map(v => targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: v }), 'json')))).filter(isValidShowSummary)),
        timed(times, `get-${monthsTag}-audience`, async () => (await Promise.all(months.map(v => targetStatsBlobs.get(computeAudienceSummaryKey({ showUuid, period: v }), 'json')))).filter(isValidAudienceSummary)),
        timed(times, `get-listens`, () => overallParam === 'stub' ? Promise.resolve(computeStubShowListenStats(showUuid)) : targetStatsBlobs.get(computeShowListenStatsKey({ showUuid }), 'json')),
    ]));
    let monthsAudiencesLarge: AudienceSummary[] | undefined;
    if (monthsAudiences.length === 0) {
        const monthParts = months.flatMap(month => [1, 2, 3, 4].map(v => ({ month, part: `${v}of4`})));
        monthsAudiencesLarge = await timed(times, `get-${monthsTag}-audience-large`, async () => (await Promise.all(monthParts.map(v => targetStatsBlobs.get(computeAudienceSummaryKey({ showUuid, period: v.month, part: v.part }), 'json')))).filter(isValidAudienceSummary));
    }

    let episodeFirstHours: Record<string, string> = {};
    let hourlyDownloads: Record<string, number> = {};
    let episodeHourlyDownloads: Record<string, Record<string, number>> = {};
    let dailyFoundAudience: Record<string, number> = {};
    let monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> = {};
    let episodeListens: Record<string, { minuteMaps: string[], appCounts: Record<string, number> }> | undefined;
    let knownAppLinks: Record<string, string> | undefined;

    if (isValidShowSummary(overall)) {
        episodeFirstHours = Object.fromEntries(Object.entries(overall.episodes).map(([ episodeId, value ]) => ([ episodeId, value.firstHour ])));

        hourlyDownloads = Object.fromEntries(monthsSummaries.flatMap(v => Object.entries(v.hourlyDownloads)));

        episodeHourlyDownloads = {};
        for (const summary of monthsSummaries) {
            for (const [ episodeId, record ] of Object.entries(summary.episodes)) {
                episodeHourlyDownloads[episodeId] = { ...episodeHourlyDownloads[episodeId], ...record.hourlyDownloads };
            }
        }
        dailyFoundAudience = {};
        for (const summary of monthsAudiencesLarge ?? monthsAudiences) {
            for (const [ date, audience ] of Object.entries(summary.dailyFoundAudience)) {
                increment(dailyFoundAudience, date, audience);
            }
        }

        monthlyDimensionDownloads = Object.fromEntries(monthsSummaries.map(v => [ v.period, v.dimensionDownloads ?? {} ]));
    }
   
    if (isValidShowListenStats(listens)) {
        episodeListens = Object.fromEntries(Object.values(listens.episodeListenStats).map(({ itemGuid, minuteMaps, appCounts }) => [ itemGuid, { minuteMaps, appCounts } ]));
        knownAppLinks = KNOWN_APP_LINKS;
    }
    return newJsonResponse(computeApiShowStatsResponse(showUuidInput, { showUuid, months, episodeFirstHours, hourlyDownloads, episodeHourlyDownloads, dailyFoundAudience, monthlyDimensionDownloads, episodeListens, knownAppLinks }));
}

export async function computeShowSummaryStatsResponse({ showUuid: showUuidInput, method, searchParams, statsBlobs, roStatsBlobs, times = {}, configuration }: StatsOpts): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    const start = Date.now();
    const { showUuid, targetStatsBlobs } = await computeStatsBlobsAndShowUuid({ showUuidInput, searchParams, statsBlobs, roStatsBlobs, configuration });
    const debug = searchParams.has('debug');

    const lastCalendarMonth = addMonthsToMonthString(new Date().toISOString().substring(0, 7), -1);

    const [ overall, monthSummary, audienceSummariesSmall ] = await timed(times, `get-overall+get-show-summary+get-audience-summary`, () => Promise.all([
        timed(times, 'get-overall', () => targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: 'overall' }), 'json')),
        timed(times, `get-show-summary`, async () => await targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: lastCalendarMonth }), 'json')),
        timed(times, `get-audience-summary`, async () => [ await targetStatsBlobs.get(computeAudienceSummaryKey({ showUuid, period: lastCalendarMonth }), 'json') ].filter(isValidAudienceSummary)),
    ]));
    if (!isValidShowSummary(overall)) return newJsonResponse({ message: 'not found' }, 404);

    let audienceSummaries = audienceSummariesSmall;
    if (audienceSummaries.length === 0) {
        const parts = [1, 2, 3, 4].map(v => `${v}of4`);
        audienceSummaries = await timed(times, `get-large-audience-summaries`, async () => (await Promise.all(parts.map(v => targetStatsBlobs.get(computeAudienceSummaryKey({ showUuid, period: lastCalendarMonth, part: v }), 'json')))).filter(isValidAudienceSummary));
    }

    const lastCalendarMonthDownloads = isValidShowSummary(monthSummary) ? total(monthSummary.hourlyDownloads) : undefined;
    const lastCalendarMonthAudience = audienceSummaries.length > 0 ? audienceSummaries.map(v => total(v.dailyFoundAudience)).reduce((a, b) => a + b, 0): undefined;
    times.compute = Date.now() - start;
    const res: ApiShowSummaryStatsResponse = { showUuid, lastCalendarMonth, lastCalendarMonthDownloads, lastCalendarMonthAudience, ...(debug ? { times } : undefined) };
    return newJsonResponse(res);
}

export async function lookupShowUuidForPodcastGuid(podcastGuid: string, { rpcClient, roRpcClient, searchParams, rawIpAddress }: { rpcClient: RpcClient, roRpcClient: RpcClient | undefined, searchParams: URLSearchParams, rawIpAddress?: string }): Promise<string | undefined> {
    const targetRpcClient = searchParams.has('ro') ? roRpcClient : rpcClient;
    if (!targetRpcClient) throw new Error(`Need rpcClient`);

    const { results = [], message } = await targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: '/show/show-uuids', parameters: { podcastGuid, ...(typeof rawIpAddress === 'string' ? { rawIpAddress } : {}) } }, DoNames.showServer);
    if (typeof message === 'string') throw new Error(message);
    return results.filter(isString).filter(isValidUuid).at(0);
}

export async function lookupShowUuidForFeedUrl(feedUrl: string, { rpcClient, roRpcClient, searchParams }: { rpcClient: RpcClient, roRpcClient: RpcClient | undefined, searchParams: URLSearchParams }): Promise<string | undefined> {
    const targetRpcClient = searchParams.has('ro') ? roRpcClient : rpcClient;
    if (!targetRpcClient) throw new Error(`Need rpcClient`);

    const { results = [] } = await targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/feeds/${feedUrl}`, parameters: { } }, DoNames.showServer);
    const feed = results.filter(isFeedRecord).at(0);
    return feed?.showUuid;
}

export function computeStatsPageUrl({ showUuid, origin }: { showUuid: string, origin: string }): string {
    return `${origin}/show/${showUuid}`;
}

export const DEMO_SHOW_1 = 'dc1852e4d1ee4bce9c4fb7f5d8be8908';

//

async function computeStatsBlobsAndShowUuid({ showUuidInput, searchParams, statsBlobs, roStatsBlobs, configuration }: { showUuidInput: string, searchParams: URLSearchParams, statsBlobs?: Blobs, roStatsBlobs?: Blobs, configuration: Configuration }): Promise<{ showUuid: string, targetStatsBlobs: Blobs }> {
    const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
    if (!targetStatsBlobs) throw new Error(`Need statsBlobs`);
    check('showUuid', showUuidInput, isValidUuid);
    const showUuid = await computeUnderlyingShowUuid(showUuidInput, configuration);
    check('showUuid', showUuid, isValidUuid);
    return { showUuid, targetStatsBlobs };
}

const computeStubShowSummary = (showUuid: string, period: string): ShowSummary => ({
    showUuid,
    period,
    episodes: {},
    hourlyDownloads: {},
    sources: {},
});

const computeStubShowListenStats = (showUuid: string): ShowListenStats => ({
    showUuid,
    episodeListenStats: {},
});

function cleanTitle(title: string | undefined): string | undefined {
    return title === undefined ? undefined : decodeXml(title, { eacute: 'é' });
}

async function computeUnderlyingShowUuid(showUuidInput: string, configuration: Configuration): Promise<string> {
    const redirectToShowUuid = SHOW_UUID_REDIRECTS[showUuidInput];
    return redirectToShowUuid ?? (showUuidInput === DEMO_SHOW_1 ? await configuration.get('demo-show-1') ?? showUuidInput : showUuidInput);
}

function computeApiShowsResponse(showUuidInput: string, underlyingResponse: ApiShowsResponse, origin: string): ApiShowsResponse {
    if (showUuidInput === DEMO_SHOW_1) {
        // swap out real titles with fake ones
        return {
            showUuid: showUuidInput,
            statsPageUrl: computeStatsPageUrl({ showUuid: showUuidInput, origin}),
            title: DEMO_SHOW_1_TITLE,
            episodes: underlyingResponse.episodes === undefined ? undefined : underlyingResponse.episodes.map((v, i) => {
                const { id, pubdate } = v;
                return {
                    id,
                    pubdate,
                    title: DEMO_SHOW_1_EPISODE_TITLES[i % DEMO_SHOW_1_EPISODE_TITLES.length],
                }
            }),
        }
    }
    return underlyingResponse;
}

function computeApiShowStatsResponse(showUuidInput: string, underlyingResponse: ApiShowStatsResponse): ApiShowStatsResponse {
    if (showUuidInput === DEMO_SHOW_1) {
        // swap out real domains with fake ones
        const domainSubs: Record<string, string> = {};
        const getSubstitute = (key: string) => {
            const existing = domainSubs[key];
            if (existing) return existing;
            const exampleDomain = DEMO_SHOW_1_REFERRER_DOMAINS[Object.keys(domainSubs).length % DEMO_SHOW_1_REFERRER_DOMAINS.length];
            domainSubs[key] = `domain.${exampleDomain}`;
            return domainSubs[key];
        };
        for (const [ _month, dimensionDownloads ] of Object.entries(underlyingResponse.monthlyDimensionDownloads)) {
            const referrerDownloads = dimensionDownloads['referrer'] ?? {};
            for (const [ key, downloads ] of Object.entries(referrerDownloads)) {
                if (key.startsWith('domain.')) {
                    delete referrerDownloads[key];
                    if (key.startsWith('domain.unknown')) continue;
                    if (downloads < 10) continue;
                    const subsKey = getSubstitute(key);
                    referrerDownloads[subsKey] = downloads;
                }
            }
        }
        
    }
    return underlyingResponse;
}

const DEMO_SHOW_1_TITLE = 'Example Travel Podcast';

const DEMO_SHOW_1_REFERRER_DOMAINS = [
    'globetrotters.com',
    'wanderlust.com',
    'traveltheworld.com',
    'journeyplanner.com',
    'tripadvisor.com',
    'travelguide.com',
    'exploretheglobe.com',
    'thetravelingnomad.com',
    'adventuretravel.com',
    'wanderlusters.com',
    'travelmore.com',
    'letsgotraveling.com',
    'globetrotting.com',
    'travelsolutions.com',
    'adventureplanner.com',
    'traveladvisor.com',
    'travelpreparation.com',
    'tripadvice.com',
    'travelplanner.com',
    'thetraveler.com',
];

const DEMO_SHOW_1_EPISODE_TITLES = [
    'The Lost City of Petra',
    'Safari in the Serengeti',
    'Island Hopping in the Philippines',
    'Trekking to Machu Picchu',
    'Exploring the Great Wall of China',
    'Foodie Adventures in Italy',
    'Surfing in Bali',
    'Cultural Immersion in Morocco',
    'Hiking in the Swiss Alps',
    'The Wonders of Australia',

    'Discovering Ancient Egypt',
    'The Magic of New Zealand',
    'Scuba Diving in the Caribbean',
    'Snowboarding in the Rocky Mountains',
    'The Beauty of the Balkans',
    'The Wilderness of Patagonia',
    'The Culture of Thailand',
    'The Charm of Ireland',
    'The Rich History of France',
    'The Wonders of Iceland',

    'The Beaches of Costa Rica',
    'The Wilderness of Alaska',
    'The Culture of Vietnam',
    'The Magic of the Maldives',
    'The Beauty of the Bahamas',
    'The Charm of Scotland',
    'The Rich History of Greece',
    'The Wonders of Japan',
    'The Beaches of Bora Bora',
    'The Wilderness of Yellowstone National Park',

    'The Culture of India',
    'The Magic of Fiji',
    'The Beauty of the Seychelles',
    'The Charm of Croatia',
    'The Rich History of Spain',
    'The Wonders of Canada',
    'The Beaches of the Dominican Republic',
    'The Wilderness of Yosemite National Park',
    'The Culture of Brazil',
    'The Magic of the Galapagos Islands',

    'The Beauty of the British Virgin Islands',
    'The Charm of Austria',
    'The Rich History of Germany',
    'The Wonders of South Africa',
    'The Beaches of the Bahamas',
    'The Wilderness of the Grand Canyon',
    'The Culture of Mexico',
    'The Magic of the Amazon Rainforest',
    'The Beauty of the Hawaiian Islands',
    'The Charm of the Netherlands',
];

export const KNOWN_APP_LINKS: Record<string, string> = {
    'Fountain': 'https://www.fountain.fm/',
    'Podverse': 'https://podverse.fm/',
    'Castamatic': 'https://castamatic.com/',
    'PodcastGuru': 'https://podcastguru.io/',
    'CurioCaster': 'https://curiocaster.com/',
    'TrueFans': 'https://truefans.fm/',
    'Podfriend': 'https://www.podfriend.com/',
    'Breez': 'https://breez.technology/',
}
