import { timed } from '../async.ts';
import { AudienceSummary, computeAudienceSummaryKey, isValidAudienceSummary } from '../backend/audience.ts';
import { Blobs } from '../backend/blobs.ts';
import { isEpisodeRecord, isFeedRecord } from '../backend/show_controller_model.ts';
import { computeShowSummaryKey, isValidShowSummary } from '../backend/show_summaries.ts';
import { check, isString } from '../check.ts';
import { compareByDescending } from '../collections.ts';
import { Configuration } from '../configuration.ts';
import { Bytes, decodeXml } from '../deps.ts';
import { DoNames } from '../do_names.ts';
import { packError } from '../errors.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { RpcClient } from '../rpc_model.ts';
import { increment } from '../summaries.ts';
import { addMonthsToMonthString } from '../timestamp.ts';
import { isValidUuid } from '../uuid.ts';
import { ApiShowsResponse, ApiShowStatsResponse } from './api_shows_model.ts';

type ShowsOpts = { showUuidOrPodcastGuidOrFeedUrlBase64: string, method: string, searchParams: URLSearchParams, rpcClient: RpcClient, roRpcClient?: RpcClient, times?: Record<string, number>, configuration: Configuration };

export async function lookupShowId({ showUuidOrPodcastGuidOrFeedUrlBase64, searchParams, rpcClient, roRpcClient, configuration }: ShowsOpts): Promise<{ showUuid: string, showUuidInput: string } | Response> {
    let showUuid: string;
    let showUuidInput: string;
    try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(showUuidOrPodcastGuidOrFeedUrlBase64)) {
            const result = await lookupShowUuidForPodcastGuid(showUuidOrPodcastGuidOrFeedUrlBase64.toLowerCase(), { rpcClient, roRpcClient, searchParams });
            if (!result) return newJsonResponse({ message: 'not found' }, 404);
            showUuidInput = result;
        } else if (isValidUuid(showUuidOrPodcastGuidOrFeedUrlBase64)) {
            showUuidInput = showUuidOrPodcastGuidOrFeedUrlBase64;
        } else if (/^[0-9a-zA-Z_-]{15,}$/i.test(showUuidOrPodcastGuidOrFeedUrlBase64)) {
            const result = await lookupShowUuidForFeedUrl(Bytes.ofBase64(showUuidOrPodcastGuidOrFeedUrlBase64, { urlSafe: true }).utf8(), { rpcClient, roRpcClient, searchParams });
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

export async function computeShowsResponse(opts: ShowsOpts): Promise<Response> {
    const { method, searchParams, rpcClient, roRpcClient, times = {} } = opts;
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
  
    const lookupResult = await lookupShowId(opts);
    if (lookupResult instanceof Response) return lookupResult;
    const { showUuid, showUuidInput } = lookupResult;

    const targetRpcClient = searchParams.has('ro') ? roRpcClient : rpcClient;
    if (!targetRpcClient) throw new Error(`Need rpcClient`);

    const [ selectShowResponse, selectEpisodesResponse ] = await timed(times, 'select-show+select-episodes', () => Promise.all([
        timed(times, 'select-show', () => targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/shows/${showUuid}` }, DoNames.showServer)),
        timed(times, 'select-episodes', () => targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/shows/${showUuid}/episodes` }, DoNames.showServer)),
    ]));
    const { results: showRecords = [] } = selectShowResponse;
    if (showRecords.length === 0) return newJsonResponse({ message: 'not found' }, 404);

    const { title, podcastGuid } = showRecords[0] as Record<string, unknown>;
    if (title !== undefined && typeof title !== 'string') throw new Error(`Bad title: ${JSON.stringify(title)}`);
    if (podcastGuid !== undefined && typeof podcastGuid !== 'string') throw new Error(`Bad podcastGuid: ${JSON.stringify(podcastGuid)}`);

    const { results: episodeRecords = [] } = selectEpisodesResponse;
    const episodes = episodeRecords
        .filter(isEpisodeRecord)
        .sort(compareByDescending(r => r.pubdateInstant))
        .map(({ id, title, pubdateInstant }) => ({ id, title: cleanTitle(title), pubdate: pubdateInstant }));

    return newJsonResponse(computeApiShowsResponse(showUuidInput, { showUuid, title, podcastGuid, episodes }));
}

type StatsOpts = { showUuid: string, method: string, searchParams: URLSearchParams, statsBlobs?: Blobs, roStatsBlobs?: Blobs, times?: Record<string, number>, configuration: Configuration };

export async function computeShowStatsResponse({ showUuid: showUuidInput, method, searchParams, statsBlobs, roStatsBlobs, times = {}, configuration }: StatsOpts): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
    if (!targetStatsBlobs) throw new Error(`Need statsBlobs`);
    check('showUuid', showUuidInput, isValidUuid);
    const showUuid = await computeUnderlyingShowUuid(showUuidInput, configuration);
    check('showUuid', showUuid, isValidUuid);
    
    const thisMonth = new Date().toISOString().substring(0, 7);
    const latestThreeMonths = [ -2, -1, 0 ].map(v => addMonthsToMonthString(thisMonth, v));

    const [ overall, latestThreeMonthSummaries, latestThreeMonthAudiences ] = await timed(times, 'get-overall+get-3mo-summary+get-3mo-audience', () => Promise.all([
        timed(times, 'get-overall', () => targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: 'overall' }), 'json')),
        timed(times, 'get-3mo-summary', async () => (await Promise.all(latestThreeMonths.map(v => targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: v }), 'json')))).filter(isValidShowSummary)),
        timed(times, 'get-3mo-audience', async () => (await Promise.all(latestThreeMonths.map(v => targetStatsBlobs.get(computeAudienceSummaryKey({ showUuid, period: v }), 'json')))).filter(isValidAudienceSummary)),
    ]));
    let latestThreeMonthAudiencesLarge: AudienceSummary[] | undefined;
    if (latestThreeMonthAudiences.length === 0) {
        const monthParts = latestThreeMonths.flatMap(month => [1, 2, 3, 4].map(v => ({ month, part: `${v}of4`})));
        latestThreeMonthAudiencesLarge = await timed(times, 'get-3mo-audience-large', async () => (await Promise.all(monthParts.map(v => targetStatsBlobs.get(computeAudienceSummaryKey({ showUuid, period: v.month, part: v.part }), 'json')))).filter(isValidAudienceSummary));
    }

    let episodeFirstHours: Record<string, string> = {};
    let hourlyDownloads: Record<string, number> = {};
    let episodeHourlyDownloads: Record<string, Record<string, number>> = {};
    let dailyFoundAudience: Record<string, number> = {};
    let monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> = {};

    if (isValidShowSummary(overall)) {
        episodeFirstHours = Object.fromEntries(Object.entries(overall.episodes).map(([ episodeId, value ]) => ([ episodeId, value.firstHour ])));

        hourlyDownloads = Object.fromEntries(latestThreeMonthSummaries.flatMap(v => Object.entries(v.hourlyDownloads)));

        episodeHourlyDownloads = {};
        for (const summary of latestThreeMonthSummaries) {
            for (const [ episodeId, record ] of Object.entries(summary.episodes)) {
                episodeHourlyDownloads[episodeId] = { ...episodeHourlyDownloads[episodeId], ...record.hourlyDownloads };
            }
        }
        dailyFoundAudience = {};
        for (const summary of latestThreeMonthAudiencesLarge ?? latestThreeMonthAudiences) {
            for (const [ date, audience ] of Object.entries(summary.dailyFoundAudience)) {
                increment(dailyFoundAudience, date, audience);
            }
        }

        monthlyDimensionDownloads = Object.fromEntries(latestThreeMonthSummaries.map(v => [ v.period, v.dimensionDownloads ?? {} ]));
    }
   
    return newJsonResponse(computeApiShowStatsResponse(showUuidInput, { showUuid, episodeFirstHours, hourlyDownloads, episodeHourlyDownloads, dailyFoundAudience, monthlyDimensionDownloads }));
}

export async function lookupShowUuidForPodcastGuid(podcastGuid: string, { rpcClient, roRpcClient, searchParams }: { rpcClient: RpcClient, roRpcClient: RpcClient | undefined, searchParams: URLSearchParams }): Promise<string | undefined> {
    const targetRpcClient = searchParams.has('ro') ? roRpcClient : rpcClient;
    if (!targetRpcClient) throw new Error(`Need rpcClient`);

    const { results = [] } = await targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: '/show/show-uuids', parameters: { podcastGuid } }, DoNames.showServer);
    return results.filter(isString).filter(isValidUuid).at(0);
}

export async function lookupShowUuidForFeedUrl(feedUrl: string, { rpcClient, roRpcClient, searchParams }: { rpcClient: RpcClient, roRpcClient: RpcClient | undefined, searchParams: URLSearchParams }): Promise<string | undefined> {
    const targetRpcClient = searchParams.has('ro') ? roRpcClient : rpcClient;
    if (!targetRpcClient) throw new Error(`Need rpcClient`);

    const { results = [] } = await targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/feeds/${feedUrl}`, parameters: { } }, DoNames.showServer);
    const feed = results.filter(isFeedRecord).at(0);
    return feed?.showUuid;
}

export const DEMO_SHOW_1 = 'dc1852e4d1ee4bce9c4fb7f5d8be8908';

//

function cleanTitle(title: string | undefined): string | undefined {
    return title === undefined ? undefined : decodeXml(title);
}

async function computeUnderlyingShowUuid(showUuidInput: string, configuration: Configuration): Promise<string> {
    return showUuidInput === DEMO_SHOW_1 ? await configuration.get('demo-show-1') ?? showUuidInput : showUuidInput;
}

function computeApiShowsResponse(showUuidInput: string, underlyingResponse: ApiShowsResponse): ApiShowsResponse {
    if (showUuidInput === DEMO_SHOW_1) {
        // swap out real titles with fake ones
        return {
            showUuid: showUuidInput,
            title: DEMO_SHOW_1_TITLE,
            episodes: underlyingResponse.episodes.map((v, i) => {
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
