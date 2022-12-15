import { check, isStringRecord, isValidMonth } from '../check.ts';
import { sortBy, zip } from '../deps.ts';
import { computeLinestream } from '../streams.ts';
import { computeBotType } from './bots.ts';
import { computeShowDailyKey, computeShowDailyKeyPrefix, unpackShowDailyKey } from './downloads.ts';
import { increment, incrementAll, total } from '../summaries.ts';
import { Blobs } from './blobs.ts';
import { isValidUuid } from '../uuid.ts';
import { timed } from '../async.ts';
import { AdminDataResponse, Unkinded } from '../rpc_model.ts';

export async function computeShowSummaryAdminDataResponse({ showUuid, parameters, statsBlobs }: { showUuid: string, parameters: Record<string, string>, statsBlobs: Blobs }): Promise<Unkinded<AdminDataResponse>> {
    const { action, month } = parameters;
    if (action === 'recompute' && isValidMonth(month)) {
        const result = await recomputeShowSummariesForMonth({ showUuid, month, statsBlobs });
        return { results: [ result ] };
    }
    throw new Error(`computeShowSummaryAdminDataResponse: Unsupported parameters: ${JSON.stringify(parameters)}`);
}

export async function recomputeShowSummariesForMonth({ showUuid, month, statsBlobs, log }: { showUuid: string, month: string, statsBlobs: Blobs, log?: boolean }) {
    check('showUuid', showUuid, isValidUuid);
    check('month', month, isValidMonth);

    const times: Record<string, number> = {};
    const keyPrefix = computeShowDailyKeyPrefix({ showUuid, datePart: month });
    const { keys: showDailyKeys } = await timed(times, 'list', () => statsBlobs.list({ keyPrefix }));
    if (log) console.log(`${showDailyKeys.length} showDailyKeys`);
    const recomputeShowSummary = async (showDailyKey: string): Promise<string> => {
        const { date } = unpackShowDailyKey(showDailyKey);
        if (log) console.log(`Computing ${date}`);
        const summary = await timed(times, 'compute-daily', () => computeShowSummaryForDate({ showUuid, date, statsBlobs }));
        if (log) console.log(`Saving ${date}`);
        const { key } = await timed(times, 'save-daily', () => saveShowSummary({ summary, statsBlobs }));
        return key;
    };
    const inputKeys = await Promise.all(showDailyKeys.map(recomputeShowSummary));
    if (log) console.log('Computing month aggregate...');
    const summary = await timed(times, 'compute-month', () => computeShowSummaryAggregate({ showUuid, inputKeys, outputPeriod: month, statsBlobs }));
    if (log) console.log('Saving month aggregate...');
    const { key: monthKey } = await timed(times, 'save-month', () => saveShowSummary({ summary, statsBlobs }));
    return { monthKey, showDailyKeys: showDailyKeys.length,  downloads: total(summary.hourlyDownloads), times };
}

export async function saveShowSummary({ summary, statsBlobs }: { summary: ShowSummary, statsBlobs: Blobs }): Promise<{ key: string, etag: string }> {
    const { showUuid, period } = summary;
    const key = computeShowSummaryKey({ showUuid, period });
    const { etag } = await statsBlobs.put(key, JSON.stringify(summary));
    return { key, etag };
}

export async function computeShowSummaryAggregate({ showUuid, inputKeys, outputPeriod, statsBlobs }: { showUuid: string, inputKeys: readonly string[], outputPeriod: string, statsBlobs: Blobs }): Promise<ShowSummary> {
    const hourlyDownloads: Record<string, number> = {};
    const sources: Record<string, string> = {};
    const episodes: Record<string, EpisodeSummary> = {};
    for (const key of inputKeys) {
        const result = await statsBlobs.get(key, 'text-and-meta');
        if (result === undefined) continue;
        const { text, etag } = result;
        const summary = JSON.parse(text) as ShowSummary;
        incrementAll(hourlyDownloads, summary.hourlyDownloads);
        for (const [ episodeId, epSummary ] of Object.entries(summary.episodes)) {
            let record = episodes[episodeId];
            if (!record) {
                record = { hourlyDownloads: {} };
                episodes[episodeId] = record;
            }
            incrementAll(record.hourlyDownloads, epSummary.hourlyDownloads);
        }
        sources[key] = etag;
    }
    return computeSorted({
        showUuid,
        period: outputPeriod,
        hourlyDownloads,
        episodes,
        sources,
    });
}

export async function computeShowSummaryForDate({ showUuid, date, statsBlobs }: { showUuid: string, date: string, statsBlobs: Blobs }): Promise<ShowSummary> {
    const key = computeShowDailyKey({ showUuid, date });
    const result = await statsBlobs.get(key, 'stream-and-meta');
    if (!result) throw new Error(`Show-daily not found: ${showUuid} ${date}`);
    const { stream, etag } = result;

    let headers: string[] | undefined;
    const hourlyDownloads: Record<string, number> = {};
    const episodes: Record<string, EpisodeSummary> = {};
    for await (const line of computeLinestream(stream)) {
        if (line === '') continue;
        const values = line.split('\t');
        if (!headers) {
            headers = values;
            continue;
        }
        const obj = Object.fromEntries(zip(headers, values));
        const { agentType, agentName, deviceType, referrerName, time, episodeId } = obj;
        const hour = time.substring(0, '2000-01-01T00'.length);
        const botType = computeBotType({ agentType, agentName, deviceType, referrerName });
        if (botType !== undefined) continue;
        increment(hourlyDownloads, hour);
        if (typeof episodeId === 'string') {
            let record = episodes[episodeId];
            if (!record) {
                record = { hourlyDownloads: {} };
                episodes[episodeId] = record;
            }
            increment(record.hourlyDownloads, hour);
        }
    }
    return computeSorted({
        showUuid,
        period: date,
        hourlyDownloads,
        episodes,
        sources: Object.fromEntries([ [ key, etag] ]),
    });
}

//

export interface ShowSummary {
    readonly showUuid: string;
    readonly period: string;
    readonly hourlyDownloads: Record<string, number>; // hour (e.g. 2022-12-01T10) -> downloads
    readonly episodes: Record<string, EpisodeSummary>; // episodeId -> 
    readonly sources: Record<string, string>;
}

export interface EpisodeSummary {
    readonly hourlyDownloads: Record<string, number>; // hour (e.g. 2022-12-01T10) -> downloads
}

//

function computeSortedRecord<T>(record: Record<string, T>): Record<string, T> {
    return Object.fromEntries(sortBy(Object.entries(record), v => v[0]));
}

function computeSorted<T>(obj: T): T {
    return Array.isArray(obj) ? obj.map(v => computeSorted(v))
        : isStringRecord(obj) ? computeSortedRecord(obj)
        // deno-lint-ignore no-explicit-any
        : obj as any;
}

function computeShowSummaryKey({ showUuid, period }: { showUuid: string, period: string }): string {
    return `summaries/show/${showUuid}/${showUuid}-${period}.summary.json`;
}
