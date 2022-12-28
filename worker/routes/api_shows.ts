import { timed } from '../async.ts';
import { AudienceSummary, computeAudienceSummaryKey, isValidAudienceSummary } from '../backend/audience.ts';
import { Blobs } from '../backend/blobs.ts';
import { isEpisodeRecord } from '../backend/show_controller_model.ts';
import { computeShowSummaryKey, isValidShowSummary } from '../backend/show_summaries.ts';
import { check } from '../check.ts';
import { compareByDescending } from '../collections.ts';
import { DoNames } from '../do_names.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { RpcClient } from '../rpc_model.ts';
import { increment } from '../summaries.ts';
import { addMonthsToMonthString } from '../timestamp.ts';
import { isValidUuid } from '../uuid.ts';
import { ApiShowsResponse, ApiShowStatsResponse } from './api_shows_model.ts';

export async function computeShowsResponse({ showUuid, method, searchParams, rpcClient, roRpcClient, times = {} }: { showUuid: string, method: string, searchParams: URLSearchParams, rpcClient: RpcClient, roRpcClient?: RpcClient, times?: Record<string, number> }): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    check('showUuid', showUuid, isValidUuid);
    
    const targetRpcClient = searchParams.has('ro') ? roRpcClient : rpcClient;
    if (!targetRpcClient) throw new Error(`Need rpcClient`);

    const [ selectShowResponse, selectEpisodesResponse ] = await timed(times, 'select-show+select-episodes', () => Promise.all([
        timed(times, 'select-show', () => targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/shows/${showUuid}` }, DoNames.showServer)),
        timed(times, 'select-episodes', () => targetRpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/shows/${showUuid}/episodes` }, DoNames.showServer)),
    ]));
    const { results: showRecords = [] } = selectShowResponse;
    if (showRecords.length === 0) return newJsonResponse({ message: 'not found' }, 404);

    const { title } = showRecords[0] as Record<string, unknown>;
    if (title !== undefined && typeof title !== 'string') throw new Error(`Bad title: ${JSON.stringify(title)}`);

    const { results: episodeRecords = [] } = selectEpisodesResponse;
    const episodes = episodeRecords
        .filter(isEpisodeRecord)
        .sort(compareByDescending(r => r.pubdateInstant))
        .map(({ id, title, pubdateInstant }) => ({ id, title, pubdate: pubdateInstant }));

    return newJsonResponse({ showUuid, title, episodes } as ApiShowsResponse);
}

export async function computeShowStatsResponse({ showUuid, method, searchParams, statsBlobs, roStatsBlobs, times = {} }: { showUuid: string, method: string, searchParams: URLSearchParams, statsBlobs?: Blobs, roStatsBlobs?: Blobs, times?: Record<string, number> }): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
    if (!targetStatsBlobs) throw new Error(`Need statsBlobs`);
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

    let episodeFirstHours: Record<string, string> | undefined;
    let hourlyDownloads: Record<string, number> | undefined;
    let episodeHourlyDownloads: Record<string, Record<string, number>> | undefined;
    let dailyFoundAudience: Record<string, number> | undefined;
    let monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> | undefined;

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
   
    return newJsonResponse({ showUuid, episodeFirstHours, hourlyDownloads, episodeHourlyDownloads, dailyFoundAudience, monthlyDimensionDownloads } as ApiShowStatsResponse);
}
