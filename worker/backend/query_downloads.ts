import { Blobs } from './blobs.ts';
import { computeShowDailyKey, computeShowDailyKeyPrefix, unpackShowDailyKey } from './downloads.ts';
import { findFirstHourForEpisodeId } from './show_summaries.ts';
import { decodeBase58, encodeBase58 } from '../base58.ts';
import { isValidDate } from '../check.ts';
import { QueryDownloadsRequest } from '../rpc_model.ts';
import { yieldTsvFromStream } from '../streams.ts';
import { addDaysToDateString } from '../timestamp.ts';
import { newQueryResponse } from '../routes/api_query_common.ts';

export async function computeQueryDownloadsResponse(request: QueryDownloadsRequest, { statsBlobs: rwStatsBlobs, roStatsBlobs }: { statsBlobs?: Blobs, roStatsBlobs?: Blobs }): Promise<Response> {
    const { showUuid, bots = 'exclude', episodeId: episodeIdFilter, limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, format = 'tsv', continuationToken: continuationTokenFilter, skipHeaders, ro} = request;

    const statsBlobs = ro ? roStatsBlobs : rwStatsBlobs;
    if (!statsBlobs) throw new Error(`Need statsBlobs!`);

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

//

const headers = [ 'time', 'url', 'audienceId', 'showUuid', 'episodeId', 'hashedIpAddress', 'agentType', 'agentName', 'deviceType', 'deviceName', 'referrerType', 'referrerName', 'botType', 'countryCode', 'continentCode', 'regionCode', 'regionName', 'timezone', 'metroCode' ];

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
