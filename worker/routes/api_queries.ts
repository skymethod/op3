import { timed } from '../async.ts';
import { Blobs } from '../backend/blobs.ts';
import { isValidShowSummary } from '../backend/show_summaries.ts';
import { computeShowSummaryKey } from '../backend/show_summaries.ts';
import { isValidHttpUrl, tryParseInt } from '../check.ts';
import { Configuration } from '../configuration.ts';
import { Bytes, sortBy } from '../deps.ts';
import { packError } from '../errors.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { RpcClient } from '../rpc_model.ts';
import { incrementAll } from '../summaries.ts';
import { addMonthsToMonthString } from '../timestamp.ts';
import { consoleWarn } from '../tracer.ts';
import { computeUserAgentEntityResult } from '../user_agents.ts';
import { isValidUuid } from '../uuid.ts';
import { QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS } from './api_contract.ts';
import { isShowDownloadCountsResponse, isValidRecentEpisodes } from './api_queries_model.ts';
import { normalizeDevice } from './api_query_common.ts';
import { lookupShowId } from './api_shows.ts';
import { computeAppDownloads } from './api_shows_shared.ts';

type Opts = { name: string, method: string, searchParams: URLSearchParams, miscBlobs?: Blobs, roMiscBlobs?: Blobs, rpcClient: RpcClient, roRpcClient?: RpcClient, configuration: Configuration, statsBlobs?: Blobs, roStatsBlobs?: Blobs };

export async function computeQueriesResponse({ name, method, searchParams, miscBlobs, roMiscBlobs, rpcClient, roRpcClient, configuration, statsBlobs, roStatsBlobs }: Opts): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    const debug = searchParams.has('debug');

    const start = Date.now();

    if (name === 'recent-episodes-with-transcripts') {
        const targetMiscBlobs = searchParams.has('ro') ? roMiscBlobs : miscBlobs;
        if (!targetMiscBlobs) throw new Error(`Need miscBlobs`);
        const { limit: limitParam } = Object.fromEntries(searchParams);
        let limit: number | undefined = QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitDefault;
        if (typeof limitParam === 'string') {
            try {
                limit = tryParseInt(limitParam);
                if (!(typeof limit === 'number' && limit >= QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMin && limit <= QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMax)) throw new Error(`Bad limit: ${limitParam}, must be an integer between ${QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMin} and ${QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMax}`);
            } catch (e) {
                const { message } = packError(e);
                return newJsonResponse({ message }, 400);
            }
        }
        const res = await targetMiscBlobs.get('recent-episodes-with-transcripts.v1.json', 'json');
        if (!isValidRecentEpisodes(res)) {
            consoleWarn('api-queries', `Invalid recent episodes: ${JSON.stringify(res)}`)
        } else {
            let rt = res;
            if (typeof limit === 'number') rt = { ...res, episodes: res.episodes.slice(0, limit) };
            const queryTime = Date.now() - start;
            return newJsonResponse({ rt, queryTime });
        }
    }

    if (name === 'top-apps-for-show') {
        const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
        if (!targetStatsBlobs) throw new Error(`Need statsBlobs`);
       
        const { showUuid: showUuidParam, podcastGuid, feedUrlBase64 } = Object.fromEntries(searchParams);
        let showUuidOrPodcastGuidOrFeedUrlBase64 = '';
        try {
            if (typeof showUuidParam === 'string') {
                if (!isValidUuid(showUuidParam)) throw new Error(`Bad showUuid: ${showUuidParam}`);
                showUuidOrPodcastGuidOrFeedUrlBase64 = showUuidParam;
            } else if (typeof podcastGuid === 'string') {
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(podcastGuid)) throw new Error(`Bad podcastGuid: ${podcastGuid}`);
                showUuidOrPodcastGuidOrFeedUrlBase64 = podcastGuid;
            } else if (typeof feedUrlBase64 === 'string') {
                if (!/^[0-9a-zA-Z_-]{15,}=*$/i.test(feedUrlBase64) || !isValidFeedUrlBase64(feedUrlBase64)) throw new Error(`Bad feedUrlBase64: ${feedUrlBase64}`);
                showUuidOrPodcastGuidOrFeedUrlBase64 = feedUrlBase64;
            }
        } catch (e) {
            const { message } = packError(e);
            return newJsonResponse({ message }, 400);
        }
        const times: Record<string, number> = {};
        const lookupResult = await lookupShowId({ showUuidOrPodcastGuidOrFeedUrlBase64, searchParams, rpcClient, roRpcClient, configuration, times });
        if (lookupResult instanceof Response) return lookupResult;
        const { showUuid, showUuidInput } = lookupResult;

        const thisMonth = new Date().toISOString().substring(0, 7);
        const latestThreeMonths = [ -2, -1, 0 ].map(v => addMonthsToMonthString(thisMonth, v));

        const latestThreeMonthSummaries = await timed(times, 'get-3mo-summary', async () => (await Promise.all(latestThreeMonths.map(v => targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: v }), 'json')))).filter(isValidShowSummary));
        const monthlyDimensionDownloads = Object.fromEntries(latestThreeMonthSummaries.map(v => [ v.period, v.dimensionDownloads ?? {} ]));

        const relevantDimensionDownloads: Record<string, Record<string, number>> = {};
        for (const dimensionDownloads of Object.values(monthlyDimensionDownloads)) {
            for (const dimension of [ 'appName', 'libraryName', 'referrer']) {
                const downloads = dimensionDownloads[dimension] ?? {};
                let row = relevantDimensionDownloads[dimension];
                if (!row) {
                    row = {};
                    relevantDimensionDownloads[dimension] = row;
                }
                incrementAll(row, downloads);
            }
        }
        const unsortedAppDownloads = computeAppDownloads(relevantDimensionDownloads);
        const appDownloads = Object.fromEntries(sortBy(Object.entries(unsortedAppDownloads), v => -v[1]));
        const queryTime = Date.now() - start;
        return newJsonResponse({ showUuid: showUuidInput, appDownloads, queryTime, ...(debug ? { times } : {}) });
    }

    if (name === 'top-apps') {
        const times: Record<string, number> = {};

        const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
        if (!targetStatsBlobs) throw new Error(`Need statsBlobs`);

        const { deviceName: deviceNameParam, userAgent } = Object.fromEntries(searchParams);
        if (typeof deviceNameParam === 'string' && typeof userAgent === 'string') return newJsonResponse({ error: `Cannot specify both 'deviceName' and 'userAgent'` }, 400);

        const inferredDeviceName = userAgent ? computeUserAgentEntityResult(userAgent)?.device?.name : undefined;

        const normDevice = normalizeDevice(inferredDeviceName ?? deviceNameParam ?? 'total');

        const obj = await targetStatsBlobs.get(`apps/${normDevice}.json`, 'json');
        if (!obj) return newJsonResponse({ error: 'unknown device' }, 400);

        const { appShares, device: deviceName, minDate, maxDate } = obj as { appShares: Record<string, number>, device?: string, minDate: string, maxDate: string };

        const queryTime = Date.now() - start;
        return newJsonResponse({ appShares, deviceName, minDate, maxDate, queryTime, ...(debug ? { times } : {}) });
    }

    if (name === 'show-download-counts') {
        const times: Record<string, number> = {};

        const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
        if (!targetStatsBlobs) throw new Error(`Need statsBlobs`);
        const obj = await targetStatsBlobs.get(`show-download-counts/current.json`, 'json');
        if (!isShowDownloadCountsResponse(obj)) return newJsonResponse({ error: 'no data!' }, 400);

        const showUuids = searchParams.getAll('showUuid');
        if (showUuids.length === 0) return newJsonResponse({ error: `Specify at least one 'showUuid' query param` }, 400);
        for (const showUuid of showUuids) {
            if (!isValidUuid(showUuid)) return newJsonResponse({ error: `Bad 'showUuid': ${showUuid}` }, 400);
        }
        const showDownloadCounts = Object.fromEntries(Object.entries(obj.showDownloadCounts).filter(v => showUuids.includes(v[0])));
        const queryTime = Date.now() - start;
        return newJsonResponse({ ...obj, showDownloadCounts, queryTime, ...(debug ? { times } : {}) });
    }

    return newJsonResponse({ error: 'not found' }, 404);
}

//

function isValidFeedUrlBase64(feedUrlBase64: string): boolean {
    try {
        const str = Bytes.ofBase64(feedUrlBase64, { urlSafe: true }).utf8();
        return isValidHttpUrl(str);
    } catch {
        return false;
    }
}
