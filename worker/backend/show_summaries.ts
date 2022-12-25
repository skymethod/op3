import { check, isStringRecord, isValidMonth, tryParseInt } from '../check.ts';
import { sortBy } from '../deps.ts';
import { computeLinestream, yieldTsvFromStream } from '../streams.ts';
import { computeShowDailyKey, computeShowDailyKeyPrefix, unpackShowDailyKey } from './downloads.ts';
import { increment, incrementAll, total } from '../summaries.ts';
import { Blobs } from './blobs.ts';
import { isValidUuid } from '../uuid.ts';
import { timed } from '../async.ts';
import { computeTimestamp, unpackDate } from '../timestamp.ts';

type Phase = 'dailies' | 'aggregates' | 'audience' | 'audience-save';

export type RecomputeShowSummariesForMonthRequest = { showUuid: string, month: string, log?: boolean, sequential?: boolean, startDay?: number, maxDays?: number, disabledPhases?: Phase[] };

export function tryParseRecomputeShowSummariesForMonthRequest({ operationKind, targetPath, parameters }: { operationKind: string, targetPath: string, parameters?: Record<string, string> }): RecomputeShowSummariesForMonthRequest | undefined {
    if (targetPath === '/work/recompute-show-summaries' && operationKind === 'update' && parameters) {
        const { show: showUuid, month, flags, startDay: startDayStr, maxDays: maxDaysStr } = parameters;
        check('show', showUuid, isValidUuid);
        check('month', month, isValidMonth);
        const flagset = new Set((flags ?? '').split(','));
        const log = flagset.has('log');
        const sequential = flagset.has('sequential');
        const disabledPhases: Phase[] = [];
        if (flagset.has('disableDailies')) disabledPhases.push('dailies');
        if (flagset.has('disableAggregates')) disabledPhases.push('aggregates');
        if (flagset.has('disableAudience')) disabledPhases.push('audience');
        if (flagset.has('disableAudienceSave')) disabledPhases.push('audience-save');
        const startDay = tryParseInt(startDayStr);
        const maxDays = tryParseInt(maxDaysStr);
        return { showUuid, month, log, sequential, disabledPhases, startDay, maxDays };
    }
}

export async function recomputeShowSummariesForMonth({ showUuid, month, log, sequential, startDay, maxDays, disabledPhases = [] }: RecomputeShowSummariesForMonthRequest, statsBlobs: Blobs) {
    check('showUuid', showUuid, isValidUuid);
    check('month', month, isValidMonth);

    const times: Record<string, number> = {};
    let rt: Record<string, unknown> = { times };

    const { keys: showDailyKeys } = disabledPhases.includes('dailies') && disabledPhases.includes('aggregates') ? { keys: [] } 
        : await timed(times, 'list', () => statsBlobs.list({ keyPrefix: computeShowDailyKeyPrefix({ showUuid, datePart: month }) }));

    if (!disabledPhases.includes('dailies')) {
        const showDailyKeysProcessed = showDailyKeys.filter(v => {
            if (maxDays === 0) return false;
            if (typeof startDay === 'number') {
                const { date } = unpackShowDailyKey(v);
                const { day } = unpackDate(date);
                if (day < startDay) return false;
                if (typeof maxDays === 'number' && day > (startDay + maxDays - 1)) return false;
            }
            return true;
        });
        if (log) console.log(`${showDailyKeys.length} showDailyKeys, ${showDailyKeysProcessed.length} showDailyKeysProcessed, sequential=${!!sequential}`);
        const recomputeShowSummary = async (showDailyKey: string): Promise<void> => {
            const { date } = unpackShowDailyKey(showDailyKey);
            if (log) console.log(`Computing ${date}`);
            const { summary, audienceTimestamps } = await timed(times, 'compute-daily', () => computeShowSummaryForDate({ showUuid, date, statsBlobs }));
            if (log) console.log(`Saving ${date}`);
            await Promise.all([
                timed(times, 'save-daily', () => saveShowSummary({ summary, statsBlobs })),
                timed(times, 'save-daily-audience', () => saveAudience({ showUuid: summary.showUuid, period: date, audienceTimestamps, statsBlobs })),
            ]);
        };
        if (sequential) {
            for (const showDailyKey of showDailyKeysProcessed) {
            await recomputeShowSummary(showDailyKey);
            }
        } else {
            await timed(times, 'recompute-parallel', () => Promise.all(showDailyKeysProcessed.map(recomputeShowSummary)));
        }
        rt = { ...rt, showDailyKeys: showDailyKeys.length, showDailyKeysProcessed: showDailyKeysProcessed.length };
    }
    if (!disabledPhases.includes('aggregates')) {
        const inputKeys = showDailyKeys.map(v => {
            const { date } = unpackShowDailyKey(v);
            return computeShowSummaryKey({ showUuid, period: date });
        });
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
    
        rt = { ...rt, monthKey, newOverall: !!newOverall, downloads: total(summary.hourlyDownloads) };
    }
    if (!disabledPhases.includes('audience')) {
        const skipSave = disabledPhases.includes('audience-save');
        const { audience, contentLength: audienceContentLength, saved: audienceSaved } = await timed(times, 'recompute-audience', () => recomputeAudienceForMonth({ showUuid, month, statsBlobs, skipSave }));
        rt = { ...rt, audience, audienceContentLength, audienceSaved };
    }

    return rt;
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
    const results = await Promise.all(inputKeys.map(async v => ({ key: v, result: await statsBlobs.get(v, 'text-and-meta') })));
    for (const { key, result } of results) {
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

export async function computeShowSummaryForDate({ showUuid, date, statsBlobs }: { showUuid: string, date: string, statsBlobs: Blobs }): Promise<{ summary: ShowSummary, audienceTimestamps: Record<string, string> }> {
    const key = computeShowDailyKey({ showUuid, date });
    const result = await statsBlobs.get(key, 'stream-and-meta');
    if (!result) throw new Error(`Show-daily not found: ${showUuid} ${date}`);
    const { stream, etag } = result;

    const hourlyDownloads: Record<string, number> = {};
    const episodes: Record<string, EpisodeSummary> = {};
    const audienceTimestamps: Record<string, string> = {};
    for await (const obj of yieldTsvFromStream(stream)) {
        const { botType, time, episodeId, audienceId } = obj;
        if (time === undefined) throw new Error(`Undefined time`);
        const hour = time.substring(0, '2000-01-01T00'.length);
        if (botType !== undefined) continue;
        increment(hourlyDownloads, hour);
        if (audienceId && !audienceTimestamps[audienceId]) audienceTimestamps[audienceId] = computeTimestamp(time);
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
    const summary = computeSorted({
        showUuid,
        period: date,
        hourlyDownloads,
        episodes,
        sources: Object.fromEntries([ [ key, etag] ]),
    });
    return { summary, audienceTimestamps };
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

export async function recomputeAudienceForMonth({ showUuid, month, statsBlobs, skipSave }: { showUuid: string, month: string, statsBlobs: Blobs, skipSave?: boolean }) {
    const { keys } = await statsBlobs.list({ keyPrefix: computeAudienceKeyPrefix({ showUuid, month }) });
    const audienceTimestamps: Record<string, string> = {};
    let count = 0;
    for (const key of keys) {
        const stream = await statsBlobs.get(key, 'stream');
        if (stream === undefined) throw new Error(`recomputeAudienceForMonth: Failed to find key: ${key}`);
        for await (const line of computeLinestream(stream)) {
            if (line.length === 0) continue;
            const audienceId = line.substring(0, 64);
            const timestamp = line.substring(65, 80);
            if (!audienceTimestamps[audienceId]) {
                audienceTimestamps[audienceId] = timestamp;
                count++;
            }
        }
    }
    const contentLength = (64 + 1 + 15 + 1) * count;

    if (skipSave) {
        return { audience: count, contentLength, saved: false };
    }

    const monthKey = computeAudienceKey({ showUuid, period: month });

    // deno-lint-ignore no-explicit-any
    const { readable, writable } = new (globalThis as any).FixedLengthStream(contentLength);
    const putPromise = statsBlobs.put(monthKey, readable) // don't await!
    const writer = writable.getWriter();
    for (const audienceId of Object.keys(audienceTimestamps)) {
        writer.write(`${audienceId}\t${audienceTimestamps[audienceId]}\n`);
    }
    await writer.close();
    // await writable.close(); // will throw on cf
    await putPromise;
    return { audience: count, contentLength, saved: true };
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

async function saveAudience({ showUuid, period, audienceTimestamps, statsBlobs }: { showUuid: string, period: string, audienceTimestamps: Record<string, string>, statsBlobs: Blobs }): Promise<{ key: string, etag: string }> {
    const key = computeAudienceKey({ showUuid, period });
    const txt = Object.entries(audienceTimestamps).map(([ audienceId, timestamp ]) => `${audienceId}\t${timestamp}\n`).join('');
    const { etag } = await statsBlobs.put(key, txt);
    return { key, etag };
}

function computeAudienceKey({ showUuid, period }: { showUuid: string, period: string }): string {
    return `audiences/show/${showUuid}/${showUuid}-${period}.audience.txt`;
}

function computeAudienceKeyPrefix({ showUuid, month }: { showUuid: string, month: string }): string {
    return `audiences/show/${showUuid}/${showUuid}-${month}-`;
}
