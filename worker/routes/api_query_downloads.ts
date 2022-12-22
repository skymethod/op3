import { Blobs } from '../backend/blobs.ts';
import { computeShowDailyKey, computeShowDailyKeyPrefix, unpackShowDailyKey } from '../backend/downloads.ts';
import { findFirstHourForEpisodeId } from '../backend/show_summaries.ts';
import { check, checkMatches, isValidDate } from '../check.ts';
import { isValidSha256Hex } from '../crypto.ts';
import { packError } from '../errors.ts';
import { newForbiddenJsonResponse, newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { ApiTokenPermission, hasPermission } from '../rpc_model.ts';
import { yieldTsvFromStream } from '../streams.ts';
import { addDaysToDateString } from '../timestamp.ts';
import { isValidUuid } from '../uuid.ts';
import { QUERY_DOWNLOADS } from './api_contract.ts';
import { ApiQueryCommonParameters, computeApiQueryCommonParameters, newQueryResponse } from './api_query_common.ts';
import { encodeBase58, decodeBase58 } from '../base58.ts';

export async function computeQueryDownloadsResponse(permissions: ReadonlySet<ApiTokenPermission>, method: string, path: string, searchParams: URLSearchParams, {statsBlobs, roStatsBlobs}: { statsBlobs?: Blobs, roStatsBlobs?: Blobs }): Promise<Response> {
    if (!hasPermission(permissions, 'preview', 'read-data')) return newForbiddenJsonResponse();
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    let req: QueryShowDownloadsRequest;
    try {
        req = parseRequest(path, searchParams);
    } catch (e) {
        const { message } = packError(e);
        return newJsonResponse({ message }, 400);
    }
    const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
    if (!targetStatsBlobs) return newJsonResponse({ message: 'statsBlobs is required' }, 500);
    return await computeQueryDownloadsResponseInternal(req, { statsBlobs: targetStatsBlobs });
}

export async function computeQueryDownloadsResponseInternal(request: QueryShowDownloadsRequest, { statsBlobs }: { statsBlobs: Blobs }): Promise<Response> {
    const { showUuid, bots = 'exclude', episodeId: episodeIdFilter, limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, format = 'tsv', continuationToken: continuationTokenFilter, skipHeaders } = request;

    let date = startTimeInclusive ? startTimeInclusive.substring(0, 10) : startTimeExclusive ? startTimeExclusive.substring(0, 10) : await computeEarliestShowDownloadDate(showUuid, statsBlobs);
    if (date && episodeIdFilter) {
        const firstHour = await findFirstHourForEpisodeId({ showUuid, episodeId: episodeIdFilter, statsBlobs });
        if (firstHour) {
            const firstDate = firstHour.substring(0, 10);
            if (date < firstDate) {
                date = firstDate;
            }
        }
    }

    const unpackedContinuationTokenFilter = continuationTokenFilter ? unpackContinuationToken(continuationTokenFilter) : undefined;

    const startTime = Date.now();
    const rows: unknown[] = [];
    let rowNumber = 0;
    if (date) {
        const today = new Date().toISOString().substring(0, 10);
        if (unpackedContinuationTokenFilter) date = unpackedContinuationTokenFilter.date;
        while (date <= today && rows.length < limit) {
            rowNumber = 0;
            console.log(`computeQueryDownloadsResponseInternal: getting ${showUuid} ${date}`);
            const stream = await statsBlobs.get(computeShowDailyKey({ date, showUuid }), 'stream');
            if (stream) {
                for await (const obj of yieldTsvFromStream(stream)) {
                    rowNumber++;
                    const { time, serverUrl: url, audienceId, showUuid, episodeId, hashedIpAddress, agentType, agentName, deviceType, deviceName, referrerType, referrerName, botType, countryCode, continentCode, regionCode, regionName, timezone, metroCode } = obj;
                    if (time === undefined) throw new Error(`Undefined time`);
                    if (unpackedContinuationTokenFilter && date === unpackedContinuationTokenFilter.date && rowNumber <= unpackedContinuationTokenFilter.rowNumber) continue;
                    if (botType && bots === 'exclude') continue;
                    if (startTimeInclusive && time < startTimeInclusive) continue;
                    if (startTimeExclusive && time <= startTimeExclusive) continue;
                    if (endTimeExclusive && time >= endTimeExclusive) break;
                    if (episodeIdFilter && episodeIdFilter !== episodeId) continue;

                    if (format === 'tsv' || format === 'json-a') {
                        const arr = [ time, url, audienceId, showUuid, episodeId, hashedIpAddress, agentType, agentName, deviceType, deviceName, referrerType, referrerName, botType, countryCode, continentCode, regionCode, regionName, timezone, metroCode ];
                        rows.push(format === 'tsv' ? arr.join('\t') : arr);
                    } else {
                        rows.push({ time, url, audienceId, showUuid, episodeId, hashedIpAddress, agentType, agentName, deviceType, deviceName, referrerType, referrerName, botType, countryCode, continentCode, regionCode, regionName, timezone, metroCode });
                    }
                    if (rows.length >= limit) break;
                }
            }
            if (rows.length < limit) date = addDaysToDateString(date, 1);
        }
    }
    const continuationToken = rows.length >= limit && date ? packContinuationToken({ date, rowNumber }) : undefined;
    return newQueryResponse({ startTime, format, headers, rows, continuationToken, skipHeaders })
}

const headers = [ 'time', 'url', 'audienceId', 'showUuid', 'episodeId', 'hashedIpAddress', 'agentType', 'agentName', 'deviceType', 'deviceName', 'referrerType', 'referrerName', 'botType', 'countryCode', 'continentCode', 'regionCode', 'regionName', 'timezone', 'metroCode' ];

//

export interface QueryShowDownloadsRequest extends ApiQueryCommonParameters {
    readonly showUuid: string;
    readonly episodeId?: string;
    readonly bots?: 'include' | 'exclude';
}

//

function parseRequest(path: string, searchParams: URLSearchParams): QueryShowDownloadsRequest {
    const m = /^\/downloads\/show\/(.*?)$/.exec(path);
    if (!m) throw new Error(`Bad api path: ${path}`);
    
    const [ _, showUuid ] = m;
    check('showUuid', showUuid, isValidUuid);

    let request: QueryShowDownloadsRequest = { showUuid, ...computeApiQueryCommonParameters(searchParams, QUERY_DOWNLOADS) };
    const { bots, episodeId } = Object.fromEntries(searchParams);
    if (typeof bots === 'string') {
        checkMatches('bots', bots, /^(include|exclude)$/);
        request = { ...request, bots: bots as 'include' | 'exclude' };
    }
    if (typeof episodeId === 'string') {
        check('episodeId', episodeId, isValidSha256Hex);
        request = { ...request, episodeId };
    }
    return request;
}

async function computeEarliestShowDownloadDate(showUuid: string, statsBlobs: Blobs): Promise<string | undefined> {
    const { keys } = await statsBlobs.list({ keyPrefix: computeShowDailyKeyPrefix({ showUuid })});
    return keys.length > 0 ? unpackShowDailyKey(keys[0]).date : undefined;
}

function packContinuationToken({ date, rowNumber }: { date: string, rowNumber: number }): string {
    return encodeBase58(new TextEncoder().encode(JSON.stringify({ date, rowNumber })));
}

function unpackContinuationToken(continuationToken: string): { date: string, rowNumber: number } {
    try {
        const { date, rowNumber } = JSON.parse(new TextDecoder().decode(decodeBase58(continuationToken)));
        const valid = isValidDate(date) && typeof rowNumber === 'number' && Number.isSafeInteger(rowNumber) && rowNumber >= 0;
        if (!valid) throw new Error();
        return { date, rowNumber };
    } catch {
        throw new Error(`Bad continuationToken: ${continuationToken}`);
    }
}
