import { Blobs } from '../backend/blobs.ts';
import { isEpisodeRecord } from '../backend/show_controller_model.ts';
import { computeShowSummaryKey, isValidShowSummary } from '../backend/show_summaries.ts';
import { check } from '../check.ts';
import { DoNames } from '../do_names.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { RpcClient } from '../rpc_model.ts';
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

export async function computeShowStatsResponse({ showUuid, method, statsBlobs }: { showUuid: string, method: string, statsBlobs?: Blobs }): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);
    if (!statsBlobs) throw new Error(`Need statsBlobs`);
    check('showUuid', showUuid, isValidUuid);
    
    const overall = await statsBlobs.get(computeShowSummaryKey({ showUuid, period: 'overall' }), 'json');
    let episodeFirstHours: Record<string, string> | undefined;
    if (isValidShowSummary(overall)) {
        episodeFirstHours = Object.fromEntries(Object.entries(overall.episodes).map(([ episodeId, value ]) => ([ episodeId, value.firstHour ])));
    }
   
    return newJsonResponse({ showUuid, episodeFirstHours });
}
