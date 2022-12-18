import { check, isStringRecord, isValidMonth } from '../check.ts';
import { sortBy } from '../deps.ts';
import { yieldTsvFromStream } from '../streams.ts';
import { computeShowDailyKey, computeShowDailyKeyPrefix, unpackShowDailyKey } from './downloads.ts';
import { increment, incrementAll, total } from '../summaries.ts';
import { Blobs } from './blobs.ts';
import { isValidUuid } from '../uuid.ts';
import { timed } from '../async.ts';
import { AdminDataResponse, Unkinded } from '../rpc_model.ts';

export function tryParseShowSummaryAdminDataRequest({ operationKind, targetPath, parameters }: { operationKind: string, targetPath: string, parameters?: Record<string, string> }): { showUuid: string, parameters: Record<string, string> } | undefined {
    const m = /^\/summaries\/show\/(.*?)$/.exec(targetPath);
    if (m && operationKind === 'update' && parameters) {
        const [ _, showUuid ] = m;
        return { showUuid, parameters };
    }
}

export async function computeShowSummaryAdminDataResponse({ showUuid, parameters, statsBlobs }: { showUuid: string, parameters: Record<string, string>, statsBlobs: Blobs }): Promise<Unkinded<AdminDataResponse>> {
    const { action, month, flags } = parameters;
    if (action === 'recompute' && isValidMonth(month)) {
        const flagset = new Set((flags ?? '').split(','));
        const log = flagset.has('log');
        const sequential = flagset.has('sequential');
        const result = await recomputeShowSummariesForMonth({ showUuid, month, statsBlobs, log, sequential });
        return { results: [ result ] };
    }
    throw new Error(`computeShowSummaryAdminDataResponse: Unsupported parameters: ${JSON.stringify(parameters)}`);
}

export async function recomputeShowSummariesForMonth({ showUuid, month, statsBlobs, log, sequential }: { showUuid: string, month: string, statsBlobs: Blobs, log?: boolean, sequential?: boolean }) {
    check('showUuid', showUuid, isValidUuid);
    check('month', month, isValidMonth);

    const times: Record<string, number> = {};
    const keyPrefix = computeShowDailyKeyPrefix({ showUuid, datePart: month });
    const { keys: showDailyKeys } = await timed(times, 'list', () => statsBlobs.list({ keyPrefix }));
    if (log) console.log(`${showDailyKeys.length} showDailyKeys, sequential=${!!sequential}`);
    const recomputeShowSummary = async (showDailyKey: string): Promise<string> => {
        const { date } = unpackShowDailyKey(showDailyKey);
        if (log) console.log(`Computing ${date}`);
        const summary = await timed(times, 'compute-daily', () => computeShowSummaryForDate({ showUuid, date, statsBlobs }));
        if (log) console.log(`Saving ${date}`);
        const { key } = await timed(times, 'save-daily', () => saveShowSummary({ summary, statsBlobs }));
        return key;
    };
    let inputKeys: string[];
    if (sequential) {
        inputKeys = [];
        for (const showDailyKey of showDailyKeys) {
            inputKeys.push(await recomputeShowSummary(showDailyKey));
        }
    } else {
        inputKeys = await Promise.all(showDailyKeys.map(recomputeShowSummary));
    }
    if (log) console.log('Computing month aggregate...');
    const summary = await timed(times, 'compute-month', () => computeShowSummaryAggregate({ showUuid, inputKeys, outputPeriod: month, statsBlobs }));
    if (log) console.log('Saving month aggregate...');
    const { key: monthKey } = await timed(times, 'save-month', () => saveShowSummary({ summary, statsBlobs }));

    if (log) console.log('Reading overall aggregate...');
    const overallKey = computeShowSummaryKey({ showUuid, period: 'overall'});
    const overall = await timed(times, 'read-overall', () => tryLoadShowSummary(overallKey, statsBlobs));
    const newOverall = tryComputeNewOverall({ overall, summary });
    if (newOverall) {
        if (log) console.log('Saving overall aggregate...');
        await timed(times, 'save-overall', () => saveShowSummary({ summary: newOverall, statsBlobs }));
    }

    return { monthKey, showDailyKeys: showDailyKeys.length, newOverall: !!newOverall, downloads: total(summary.hourlyDownloads), times };
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
                record = { hourlyDownloads: {}, firstHour: epSummary.firstHour };
                episodes[episodeId] = record;
            }
            if (epSummary.firstHour < record.firstHour) {
                record = { ...record, firstHour: epSummary.firstHour };
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

    const hourlyDownloads: Record<string, number> = {};
    const episodes: Record<string, EpisodeSummary> = {};
    for await (const obj of yieldTsvFromStream(stream)) {
        const { botType, time, episodeId } = obj;
        if (time === undefined) throw new Error(`Undefined time`);
        const hour = time.substring(0, '2000-01-01T00'.length);
        if (botType !== undefined) continue;
        increment(hourlyDownloads, hour);
        if (typeof episodeId === 'string') {
            let record = episodes[episodeId];
            if (!record) {
                record = { hourlyDownloads: {}, firstHour: hour };
                episodes[episodeId] = record;
            }
            if (hour < record.firstHour) {
                record = { ...record, firstHour: hour };
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

export function computeShowSummaryKey({ showUuid, period }: { showUuid: string, period: string }): string {
    return `summaries/show/${showUuid}/${showUuid}-${period}.summary.json`;
}

export async function tryLoadShowSummary(key: string, statsBlobs: Blobs): Promise<ShowSummary | undefined> {
    const result = await statsBlobs.get(key, 'text');
    if (result) {
        const obj = JSON.parse(result);
        if (!isValidShowSummary(obj)) throw new Error(`Invalid showSummary at ${key}`);
        return obj;
    }
}

export async function findFirstHourForEpisodeId({ showUuid, episodeId, statsBlobs }: { showUuid: string, episodeId: string, statsBlobs: Blobs }): Promise<string | undefined> {
    const summary = await tryLoadShowSummary(computeShowSummaryKey({ showUuid, period: 'overall' }), statsBlobs);
    if (summary) {
        const epSummary = summary.episodes[episodeId];
        return epSummary?.firstHour;
    }
}


//

export interface ShowSummary {
    readonly showUuid: string;
    readonly period: string;
    readonly hourlyDownloads: Record<string, number>; // hour (e.g. 2022-12-01T10) -> downloads
    readonly episodes: Record<string, EpisodeSummary>; // episodeId -> 
    readonly sources: Record<string, string>;
}

export function isValidShowSummary(obj: unknown): obj is ShowSummary {
    return isStringRecord(obj)
        && typeof obj.showUuid === 'string'
        && typeof obj.period === 'string'
        && isStringRecord(obj.hourlyDownloads)
        && isStringRecord(obj.episodes)
        && isStringRecord(obj.sources)
        ;
}

export interface EpisodeSummary {
    readonly hourlyDownloads: Record<string, number>; // hour (e.g. 2022-12-01T10) -> downloads
    readonly firstHour: string; // hour (e.g. 2022-12-01T10) first download seen
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

function tryComputeNewOverall({ overall, summary }: { overall?: ShowSummary, summary: ShowSummary }): ShowSummary | undefined {
    const rt: ShowSummary = overall ?? { showUuid: summary.showUuid, period: 'overall', episodes: {}, hourlyDownloads: {}, sources: {} };
    let changed = overall === undefined;
    for (const [ episodeId, epSummary ] of Object.entries(summary.episodes)) {
        const existingEpSummary = rt.episodes[episodeId]
        if (!existingEpSummary || epSummary.firstHour < existingEpSummary.firstHour) {
            rt.episodes[episodeId] = { ...(existingEpSummary ?? { hourlyDownloads: {} }), firstHour: epSummary.firstHour };
            changed = true;
        }
    }
    return changed ? rt : undefined;
}
