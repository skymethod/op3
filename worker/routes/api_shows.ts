import { Blobs } from '../backend/blobs.ts';
import { isEpisodeRecord } from '../backend/show_controller_model.ts';
import { computeShowSummaryKey, isValidShowSummary } from '../backend/show_summaries.ts';
import { check } from '../check.ts';
import { DoNames } from '../do_names.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { RpcClient } from '../rpc_model.ts';
import { addMonthsToMonthString } from '../timestamp.ts';
import { isValidUuid } from '../uuid.ts';

export async function computeShowsResponse({ showUuid, method, rpcClient }: { showUuid: string, method: string, rpcClient: RpcClient }): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    check('showUuid', showUuid, isValidUuid);
    
    const { results: showRecords = [] } = await rpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/shows/${showUuid}` }, DoNames.showServer);
    if (showRecords.length === 0) return newJsonResponse({ message: 'not found' }, 404);

    const { title } = showRecords[0] as Record<string, unknown>;
    if (title !== undefined && typeof title !== 'string') throw new Error(`Bad title: ${JSON.stringify(title)}`);

    const { results: episodeRecords = [] } = await rpcClient.adminExecuteDataQuery({ operationKind: 'select', targetPath: `/show/shows/${showUuid}/episodes` }, DoNames.showServer);

    const episodes = episodeRecords.filter(isEpisodeRecord).map(({ id, title, pubdateInstant }) => ({ id, title, pubdate: pubdateInstant }));
    return newJsonResponse({ showUuid, title, episodes });
}

export async function computeShowStatsResponse({ showUuid, method, searchParams, statsBlobs, roStatsBlobs }: { showUuid: string, method: string, searchParams: URLSearchParams, statsBlobs?: Blobs, roStatsBlobs?: Blobs }): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
    if (!targetStatsBlobs) throw new Error(`Need statsBlobs`);
    check('showUuid', showUuid, isValidUuid);
    
    const overall = await targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: 'overall' }), 'json');
    let episodeFirstHours: Record<string, string> | undefined;
    let hourlyDownloads: Record<string, number> | undefined;
    if (isValidShowSummary(overall)) {
        episodeFirstHours = Object.fromEntries(Object.entries(overall.episodes).map(([ episodeId, value ]) => ([ episodeId, value.firstHour ])));

        const thisMonth = new Date().toISOString().substring(0, 7);
        const latestThreeMonths = [ -2, -1, 0 ].map(v => addMonthsToMonthString(thisMonth, v));
        const latestThreeMonthSummaries = (await Promise.all(latestThreeMonths.map(v => targetStatsBlobs.get(computeShowSummaryKey({ showUuid, period: v }), 'json')))).filter(isValidShowSummary);
        hourlyDownloads = Object.fromEntries(latestThreeMonthSummaries.flatMap(v => Object.entries(v.hourlyDownloads)));
    }
   
    return newJsonResponse({ showUuid, episodeFirstHours, hourlyDownloads });
}