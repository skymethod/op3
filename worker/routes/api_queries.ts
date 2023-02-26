import { timed } from '../async.ts';
import { Blobs } from '../backend/blobs.ts';
import { isValidShowSummary } from '../backend/show_summaries.ts';
import { computeShowSummaryKey } from '../backend/show_summaries.ts';
import { tryParseInt } from '../check.ts';
import { Configuration } from '../configuration.ts';
import { sortBy } from '../deps.ts';
import { packError } from '../errors.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { RpcClient } from '../rpc_model.ts';
import { incrementAll } from '../summaries.ts';
import { addMonthsToMonthString } from '../timestamp.ts';
import { consoleWarn } from '../tracer.ts';
import { isValidUuid } from '../uuid.ts';
import { QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS } from './api_contract.ts';
import { isValidRecentEpisodes } from './api_queries_model.ts';
import { lookupShowId } from './api_shows.ts';
import { computeAppDownloads } from './api_shows_shared.ts';

type Opts = { name: string, method: string, searchParams: URLSearchParams, miscBlobs?: Blobs, roMiscBlobs?: Blobs, rpcClient: RpcClient, roRpcClient?: RpcClient, configuration: Configuration, statsBlobs?: Blobs, roStatsBlobs?: Blobs };

export async function computeQueriesResponse({ name, method, searchParams, miscBlobs, roMiscBlobs, rpcClient, roRpcClient, configuration, statsBlobs, roStatsBlobs }: Opts): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

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
            return newJsonResponse(rt);
        }
    }

    if (name === 'top-apps-for-show') {
        const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
        if (!targetStatsBlobs) throw new Error(`Need statsBlobs`);

        const { showUuid: showUuidParam } = Object.fromEntries(searchParams);
        let showUuidOrPodcastGuidOrFeedUrlBase64 = '';
        if (typeof showUuidParam === 'string') {
            if (!isValidUuid(showUuidParam)) throw new Error(`Bad showUuid: ${showUuidParam}`);
            showUuidOrPodcastGuidOrFeedUrlBase64 = showUuidParam;
        }
        const times: Record<string, number> = {};
        const lookupResult = await lookupShowId({ showUuidOrPodcastGuidOrFeedUrlBase64, method: 'GET', searchParams, rpcClient, roRpcClient, configuration, times });
        if (lookupResult instanceof Response) return lookupResult;
        const { showUuid, showUuidInput } = lookupResult;

        const thisMonth = new Date().toISOString().substring(0, 7);
        const latestThreeMonths = [ -2, -1, 0 ].map(v => addMonthsToMonthString(thisMonth, v));

        const latestThreeMonthSummaries = await timed(times, 'get-3mo-summary', async () => (await Promise.all(latestThreeMonths.map(v => targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: v }), 'json')))).filter(isValidShowSummary));
        const monthlyDimensionDownloads = Object.fromEntries(latestThreeMonthSummaries.map(v => [ v.period, v.dimensionDownloads ?? {} ]));

        const relevantDimensionDownloads: Record<string, Record<string, number>> = {};
        for (const dimensionDownloads of Object.values(monthlyDimensionDownloads)) {
            for (const dimension of [ 'appName', 'libraryName', 'referrer']) {
                const downloads = dimensionDownloads[dimension];
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
        
        return newJsonResponse({ showUuid: showUuidInput, appDownloads, times });
    }

    return newJsonResponse({ error: 'not found' }, 404);
}
