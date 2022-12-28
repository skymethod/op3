import { check, isStringRecord, isValidMonth, tryParseInt } from '../check.ts';
import { sortBy } from '../deps.ts';
import { yieldTsvFromStream } from '../streams.ts';
import { computeShowDailyKey, computeShowDailyKeyPrefix, unpackShowDailyKey } from './downloads.ts';
import { increment, incrementAll, total } from '../summaries.ts';
import { Blobs } from './blobs.ts';
import { isValidUuid } from '../uuid.ts';
import { timed } from '../async.ts';
import { computeTimestamp, unpackDate } from '../timestamp.ts';
import { recomputeAudienceForMonth, saveAudience } from './audience.ts';

export type RecomputeShowSummariesForMonthRequest = { showUuid: string, month: string, log?: boolean, sequential?: boolean, startDay?: number, maxDays?: number, phases?: Phase[] };

export function tryParseRecomputeShowSummariesForMonthRequest({ operationKind, targetPath, parameters }: { operationKind: string, targetPath: string, parameters?: Record<string, string> }): RecomputeShowSummariesForMonthRequest | undefined {
    if (targetPath === '/work/recompute-show-summaries' && operationKind === 'update' && parameters) {
        const { show: showUuid, month, flags, phases: phasesStr, startDay: startDayStr, maxDays: maxDaysStr } = parameters;
        check('show', showUuid, isValidUuid);
        check('month', month, isValidMonth);
        const flagset = new Set((flags ?? '').split(','));
        const log = flagset.has('log');
        const sequential = flagset.has('sequential');
        const phases = phasesStr ? phasesStr.split(',').filter(isPhase) : undefined;
        const startDay = tryParseInt(startDayStr);
        const maxDays = tryParseInt(maxDaysStr);
        return { showUuid, month, log, sequential, phases, startDay, maxDays };
    }
}

export async function recomputeShowSummariesForMonth({ showUuid, month, log, sequential, startDay, maxDays, phases = [ 'dailies', 'aggregates', 'audience' ] }: RecomputeShowSummariesForMonthRequest, statsBlobs: Blobs) {
    check('showUuid', showUuid, isValidUuid);
    check('month', month, isValidMonth);

    const times: Record<string, number> = {};
    let rt: Record<string, unknown> = { times, phases };

    const runDailies = phases.includes('dailies');
    const runAggregates = phases.includes('aggregates');
    const { keys: showDailyKeys } = runDailies || runAggregates ? await timed(times, 'list', () => statsBlobs.list({ keyPrefix: computeShowDailyKeyPrefix({ showUuid, datePart: month }) }))
        : { keys: [] };

    if (runDailies) {
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
    if (runAggregates) {
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
    if (phases.some(v => v.startsWith('audience'))) {
        const part = phases.includes('audience-1of4') ? '1of4'
            : phases.includes('audience-2of4') ? '2of4'
            : phases.includes('audience-3of4') ? '3of4'
            : phases.includes('audience-4of4') ? '4of4'
            : undefined;
        const { audience, contentLength: audienceContentLength, part: audiencePart } = await timed(times, 'recompute-audience', () => recomputeAudienceForMonth({ showUuid, month, statsBlobs, part }));
        rt = { ...rt, audience, audienceContentLength, audiencePart };
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
    const countryDownloads: Record<string, number> = {};
    const results = await Promise.all(inputKeys.map(async v => ({ key: v, result: await statsBlobs.get(v, 'text-and-meta') })));
    for (const { key, result } of results) {
        if (result === undefined) continue;
        const { text, etag } = result;
        const summary = JSON.parse(text) as ShowSummary;
        incrementAll(hourlyDownloads, summary.hourlyDownloads);
        incrementAll(countryDownloads, summary.countryDownloads ?? {});
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
        countryDownloads,
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
    const countryDownloads: Record<string, number> = {};
    for await (const obj of yieldTsvFromStream(stream)) {
        const { botType, time, episodeId, audienceId, countryCode = 'XX' } = obj;
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
        increment(countryDownloads, countryCode);
    }
    const summary = computeSorted({
        showUuid,
        period: date,
        hourlyDownloads,
        episodes,
        countryDownloads,
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

//

export interface ShowSummary {
    readonly showUuid: string;
    readonly period: string;
    readonly hourlyDownloads: Record<string, number>; // hour (e.g. 2022-12-01T10) -> downloads
    readonly episodes: Record<string, EpisodeSummary>; // episodeId -> 
    readonly sources: Record<string, string>;
    readonly countryDownloads?: Record<string, number>; // countryCode
}

export function isValidShowSummary(obj: unknown): obj is ShowSummary {
    return isStringRecord(obj)
        && typeof obj.showUuid === 'string'
        && typeof obj.period === 'string'
        && isStringRecord(obj.hourlyDownloads)
        && isStringRecord(obj.episodes)
        && isStringRecord(obj.sources)
        && (obj.countryDownloads === undefined || isStringRecord(obj.countryDownloads))
        ;
}

export interface EpisodeSummary {
    readonly hourlyDownloads: Record<string, number>; // hour (e.g. 2022-12-01T10) -> downloads
    readonly firstHour: string; // hour (e.g. 2022-12-01T10) first download seen
}

type Phase = 'dailies' | 'aggregates' | 'audience' | 'audience-1of4' | 'audience-2of4' | 'audience-3of4' | 'audience-4of4';

function isPhase(v: string): v is Phase {
    return v === 'dailies' || v === 'aggregates' || v === 'audience' || v === 'audience-1of4' || v === 'audience-2of4' || v === 'audience-3of4' || v === 'audience-4of4';
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
