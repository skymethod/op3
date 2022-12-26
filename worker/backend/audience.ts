import { check, checkMatches, isStringRecord, isValidDate, isValidMonth } from '../check.ts';
import { computeLinestream } from '../streams.ts';
import { increment } from '../summaries.ts';
import { isValidUuid } from '../uuid.ts';
import { Blobs } from './blobs.ts';

export async function recomputeAudienceForMonth({ showUuid, month, statsBlobs, part }: { showUuid: string, month: string, statsBlobs: Blobs, part?: '1of4' | '2of4' | '3of4' | '4of4' }) {
    const { keys } = await statsBlobs.list({ keyPrefix: computeAudienceKeyPrefix({ showUuid, month }) });
    const audienceTimestamps: Record<string, string> = {};
    const audienceSummary: AudienceSummary = { showUuid, period: month, part, dailyFoundAudience: {} };
    let count = 0;
    for (const key of keys) {
        const stream = await statsBlobs.get(key, 'stream');
        if (stream === undefined) throw new Error(`recomputeAudienceForMonth: Failed to find key: ${key}`);
        const { period: date } = unpackAudienceKey(key);
        check('date', date, isValidDate);
        for await (const line of computeLinestream(stream)) {
            if (line.length === 0) continue;
            if (part) {
                const linePart = line < '4' ? '1of4' : line < '8' ? '2of4' : line < 'c' ? '3of4' : '4of4';
                if (linePart !== part) continue;
            }
            const audienceId = line.substring(0, 64);
            const timestamp = line.substring(65, 80);
            increment(audienceSummary.dailyFoundAudience, date);
            if (!audienceTimestamps[audienceId]) {
                audienceTimestamps[audienceId] = timestamp;
                count++;
            }
        }
    }
    const contentLength = (64 + 1 + 15 + 1) * count;

    const putAudience = async () => {
        const audiencePartKey = computeAudienceKey({ showUuid, period: month, part });

        // deno-lint-ignore no-explicit-any
        const { readable, writable } = new (globalThis as any).FixedLengthStream(contentLength);
        const putPromise = statsBlobs.put(audiencePartKey, readable) // don't await!
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        for (const audienceId of Object.keys(audienceTimestamps)) {
            writer.write(encoder.encode(`${audienceId}\t${audienceTimestamps[audienceId]}\n`));
        }
        await writer.close();
        // await writable.close(); // will throw on cf
        await putPromise;
    };

    const putAudienceSummary = async () => {
        const audienceSummaryPartKey = computeAudienceSummaryKey(audienceSummary);
        await statsBlobs.put(audienceSummaryPartKey, JSON.stringify(audienceSummary));
    }

    await Promise.all([ putAudience(), putAudienceSummary() ]);

    return { audience: count, contentLength, part };
}

export async function saveAudience({ showUuid, period, audienceTimestamps, statsBlobs }: { showUuid: string, period: string, audienceTimestamps: Record<string, string>, statsBlobs: Blobs }): Promise<{ key: string, etag: string }> {
    const key = computeAudienceKey({ showUuid, period });
    const txt = Object.entries(audienceTimestamps).map(([ audienceId, timestamp ]) => `${audienceId}\t${timestamp}\n`).join('');
    const { etag } = await statsBlobs.put(key, txt);
    return { key, etag };
}

//

export interface AudienceSummary {
    readonly showUuid: string;
    readonly period: string;
    readonly part?: string;
    readonly dailyFoundAudience: Record<string, number>; // day (e.g. 2022-12-01) -> audience first seen
}

export function isValidAudienceSummary(obj: unknown): obj is AudienceSummary {
    return isStringRecord(obj)
        && typeof obj.showUuid === 'string'
        && typeof obj.period === 'string'
        && (obj.part === undefined || typeof obj.part === 'string')
        && isStringRecord(obj.dailyFoundAudience)
        ;
}

//

function computeAudienceKey({ showUuid, period, part }: { showUuid: string, period: string, part?: string }): string {
    return `audiences/show/${showUuid}/${showUuid}-${period}.${part ?? 'all'}.audience.txt`;
}

function computeAudienceKeyPrefix({ showUuid, month }: { showUuid: string, month: string }): string {
    return `audiences/show/${showUuid}/${showUuid}-${month}-`;
}

function unpackAudienceKey(key: string): { showUuid: string, period: string, part?: string } {
    const [ _, showUuid, showUuid2, period, partStr ] = checkMatches('key', key, /^audiences\/show\/(.*?)\/(.*?)-(.*?)\.(.*?)\.audience\.txt$/);
    check('key', key, showUuid === showUuid2 && isValidUuid(showUuid) && (isValidDate(period) || isValidMonth(period)));
    const part = partStr === 'all' ? undefined : partStr;
    return { showUuid, period, part };
}

function computeAudienceSummaryKey({ showUuid, period, part }: { showUuid: string, period: string, part?: string }): string {
    return `audience-summaries/show/${showUuid}/${showUuid}-${period}.${part ?? 'all'}.audience-summary.json`;
}
