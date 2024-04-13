import { DurableObjectStorage } from '../deps.ts';
import { computeServerUrl } from '../client_params.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { Unkinded, QueryHitsIndexRequest } from '../rpc_model.ts';
import { computeTimestamp, addMonthsToMonthString, addDaysToDateString } from '../timestamp.ts';
import { isValidSortKey } from './hits_common.ts';

export enum IndexId {
    MonthHashedIpAddress = 1,
    DayUrl = 2,
}

export const INDEX_DEFINITIONS: [ string, IndexId, (v: string, timestamp: string) => string | undefined | Promise<string | undefined> ][] = [
    [ 'hashedIpAddress', IndexId.MonthHashedIpAddress, (v, timestamp) => `${timestamp.substring(0, 4)}.${unpackHashedIpAddressHash(v)}` ],
    [ 'url', IndexId.DayUrl, (v, timestamp) => `${timestamp.substring(0, 6)}.${computeServerUrl(v).substring(0, 1024)}` ],
];

export async function computeIndexRecords(record: Record<string, string>, timestamp: string, sortKey: string, outIndexRecords: Record<string, string>, filterIndexId?: IndexId): Promise<void> {
    for (const [ property, indexId, indexValueFn ] of INDEX_DEFINITIONS) {
        if (filterIndexId && filterIndexId !== indexId) continue;
        const value = record[property];
        if (typeof value !== 'string') continue;
        const indexValueValueOrPromise = indexValueFn(value, timestamp);
        const indexValue = typeof indexValueValueOrPromise === 'object' ? await indexValueValueOrPromise : indexValueValueOrPromise;
        if (typeof indexValue !== 'string') continue;
        outIndexRecords[`hits.i0.${indexId}.${indexValue}.${sortKey}`] = sortKey;
    }
}

export function computeIndexWindowStartInstant(): string {
    // allow for querying 90 full days
    const today = new Date().toISOString().substring(0, 10);
    const startDate = addDaysToDateString(today, -91);
    return maxString(`${startDate}T00:00:00.000Z`, indexEpochInstant);
}

export async function queryHitsIndexFromStorage(request: Unkinded<QueryHitsIndexRequest>, storage: DurableObjectStorage): Promise<string[]> {
    const { limit, descending, startTimeInclusive, startTimeExclusive, endTimeExclusive, hashedIpAddress, rawIpAddress } = request;
    if (typeof rawIpAddress === 'string') throw new Error(`Not allowed to query for a raw ip address`);
    const rt: string[] = [];
    if (limit <= 0) return rt;
    if (typeof hashedIpAddress === 'string') {
        const windowStart = computeIndexWindowStartInstant();
        const windowStartTimestamp = computeTimestamp(windowStart);
        const windowStartMonth = windowStart.substring(0, 7);
        const now = new Date().toISOString();
        const maxListCalls = 6; // window is only 90 days so this is more than enough
        if (descending) {
            // start at end month (or current) and work backward
            let month = minString(now, endTimeExclusive ?? now).substring(0, 7);
            let listCalls = 0;
            while (month >= windowStartMonth) {
                const monthstamp = computeTimestamp(`${month}-01T00:00:00.000Z`).substring(0, 4);
                const prefix = `hits.i0.${IndexId.MonthHashedIpAddress}.${monthstamp}.${hashedIpAddress}.`;
                const start = startTimeInclusive ? `${prefix}${computeTimestamp(startTimeInclusive)}` : undefined;
                const startAfter = startTimeExclusive ? `${prefix}${computeTimestamp(startTimeExclusive)}` : undefined;
                const end = endTimeExclusive ? `${prefix}${computeTimestamp(endTimeExclusive)}` : undefined;
                if (listCalls >= maxListCalls) throw new Error(`Max list calls!`);
                const map = await storage.list({ limit: limit - rt.length, reverse: true, noCache: true, allowConcurrency: true, prefix, start, startAfter, end });
                listCalls++;
                for (const [ key, value ] of map) {
                    if (typeof value !== 'string' || !isValidSortKey(value)) throw new Error(`Unexpected index record: ${JSON.stringify({ key, value })}`);
                    if (value < windowStartTimestamp) continue;
                    rt.push(value);
                    if (rt.length >= limit) return rt;
                }
                month = addMonthsToMonthString(month, -1);
            }
            return rt;
        } else {
            // start at start month and work forward
            const currentMonth = now.substring(0, 7);
            let month = maxString(now, startTimeInclusive ?? startTimeExclusive ?? windowStartMonth).substring(0, 7);
            let listCalls = 0;
            while (month <= currentMonth) {
                const monthstamp = computeTimestamp(`${month}-01T00:00:00.000Z`).substring(0, 4);
                const prefix = `hits.i0.${IndexId.MonthHashedIpAddress}.${monthstamp}.${hashedIpAddress}.`;
                const start = startTimeInclusive ? `${prefix}${computeTimestamp(startTimeInclusive)}` : undefined;
                const startAfter = startTimeExclusive ? `${prefix}${computeTimestamp(startTimeExclusive)}` : undefined;
                const end = endTimeExclusive ? `${prefix}${computeTimestamp(endTimeExclusive)}` : undefined;
                if (listCalls >= maxListCalls) throw new Error(`Max list calls!`);
                const map = await storage.list({ limit: limit - rt.length, reverse: false, noCache: true, allowConcurrency: true, prefix, start, startAfter, end });
                listCalls++;
                for (const [ key, value ] of map) {
                    if (typeof value !== 'string' || !isValidSortKey(value)) throw new Error(`Unexpected index record: ${JSON.stringify({ key, value })}`);
                    if (value < windowStartTimestamp) continue;
                    rt.push(value);
                    if (rt.length >= limit) return rt;
                }
                month = addMonthsToMonthString(month, 1);
            }
            return rt;
        }
    } else {
        throw new Error(`Unsupported request: ${request}`);
    }
}

//

const indexEpochInstant = '2024-04-13T00:00:00.000Z';

function minString(lhs: string, rhs: string): string {
    return lhs < rhs ? lhs : rhs;
}

function maxString(lhs: string, rhs: string): string {
    return lhs > rhs ? lhs : rhs;
}
