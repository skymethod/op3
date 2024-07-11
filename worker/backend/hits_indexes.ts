import { DurableObjectStorage } from '../deps.ts';
import { computeServerUrl } from '../client_params.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { Unkinded, QueryHitsIndexRequest } from '../rpc_model.ts';
import { computeTimestamp, addMonthsToMonthString, addDaysToDateString } from '../timestamp.ts';
import { isValidSortKey, computeIndexWindowStartInstant } from './hits_common.ts';
import { maxString, minString } from '../collections.ts';

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

export type DeletionInfo = { iterations: number, listed: number, deleted: number, minKey?: string, maxKey?: string, end: string };

export async function trimIndexRecords({ maxIterations, go }: { maxIterations: number, go: boolean }, storage: DurableObjectStorage): Promise<Record<string, DeletionInfo>> {
    const windowStart = computeIndexWindowStartInstant();
    const windowStartTimestamp = computeTimestamp(windowStart);
    const windowStartTimestampMonth = windowStartTimestamp.substring(0, 4);
    const windowStartTimestampDay = windowStartTimestamp.substring(0, 6);
    
    const rt: Record<string, DeletionInfo> = {};

    const trimIndex = async (indexId: IndexId, type: 'day' | 'month') => {
        const end = `hits.i0.${indexId}.${type === 'month' ? windowStartTimestampMonth : windowStartTimestampDay}`;
        const info: DeletionInfo = { end, iterations: 0, listed: 0, deleted: 0 };
        rt[IndexId[indexId]] = info;
        const limit = 128; // max delete
        for (let i = 0; i < maxIterations; i++) {
            info.iterations++;
            const map = await storage.list({ prefix: `hits.i0.${indexId}.`, end, limit, allowConcurrency: true, noCache: true });
            const keys = [...map.keys()].sort();
            if (keys.length === 0) break;
            info.listed += keys.length;
            if (info.minKey === undefined || keys[0] < info.minKey) info.minKey = keys[0];
            if (info.maxKey === undefined || keys[keys.length - 1] > info.maxKey) info.maxKey = keys[keys.length - 1];
            if (!go) break;
            info.deleted += await storage.delete(keys, { noCache: true });
            if (keys.length < limit) break;
        }
    }
    await trimIndex(IndexId.MonthHashedIpAddress, 'month');
    await trimIndex(IndexId.DayUrl, 'day');

    return rt;
}

export async function queryHitsIndexFromStorage(request: Unkinded<QueryHitsIndexRequest>, storage: DurableObjectStorage): Promise<string[]> {
    const { limit, descending, startTimeInclusive, startTimeExclusive, endTimeExclusive, hashedIpAddress, rawIpAddress, url, urlStartsWith } = request;
    if (typeof rawIpAddress === 'string') throw new Error(`Unable to query for a raw ip address, they are not stored`);
    const rt: string[] = [];
    if (limit <= 0) return rt;

    const now = new Date().toISOString();
    const windowStart = computeIndexWindowStartInstant();
    const windowStartTimestamp = computeTimestamp(windowStart);

    if (typeof hashedIpAddress === 'string') {
        const windowStartMonth = windowStart.substring(0, 7);
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
            // start at start month (or window start) and work forward
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
    } else if (typeof url === 'string') {
        const windowStartDate = windowStart.substring(0, 10);
        const dayUrlIndexDef = INDEX_DEFINITIONS.find(v => v[1] === IndexId.DayUrl)!;
        const maxListCalls = 10;
        if (descending) {
            // start at end date (or current) and work backward
            let date = minString(now, endTimeExclusive ?? now).substring(0, 10);
            let listCalls = 0;
            while (date >= windowStartDate) {
                const datestamp = computeTimestamp(`${date}T00:00:00.000Z`).substring(0, 6);
                const indexValue = dayUrlIndexDef[2](url, datestamp);
                const prefix = `hits.i0.${IndexId.DayUrl}.${indexValue}.`;
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
                date = addDaysToDateString(date, -1);
            }
            return rt;
        } else {
            // start at start date (or window start) and work forward
            const currentDate = now.substring(0, 10);
            let date = maxString(now, startTimeInclusive ?? startTimeExclusive ?? windowStartDate).substring(0, 10);
            let listCalls = 0;
            while (date <= currentDate) {
                const datestamp = computeTimestamp(`${date}T00:00:00.000Z`).substring(0, 6);
                const indexValue = dayUrlIndexDef[2](url, datestamp);
                const prefix = `hits.i0.${IndexId.DayUrl}.${indexValue}.`;
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
                date = addDaysToDateString(date, 1);
            }
            return rt;
        }
    } else if (typeof urlStartsWith === 'string') {
        const windowStartDate = windowStart.substring(0, 10);
        const dayUrlIndexDef = INDEX_DEFINITIONS.find(v => v[1] === IndexId.DayUrl)!;
        const maxListCalls = 10;
        const startTimestamp = startTimeInclusive ? computeTimestamp(startTimeInclusive) : undefined;
        const startAfterTimestamp = startTimeExclusive ? computeTimestamp(startTimeExclusive) : undefined;
        const endTimestamp = endTimeExclusive ? computeTimestamp(endTimeExclusive) : undefined;
        if (descending) {
            // start at end date (or current) and work backward
            let date = minString(now, endTimeExclusive ?? now).substring(0, 10);
            let listCalls = 0;
            while (date >= windowStartDate) {
                const datestamp = computeTimestamp(`${date}T00:00:00.000Z`).substring(0, 6);
                const indexValuePrefix = dayUrlIndexDef[2](urlStartsWith, datestamp);
                const prefix = `hits.i0.${IndexId.DayUrl}.${indexValuePrefix}`;
                if (listCalls >= maxListCalls) throw new Error(`Max list calls!`);
                const map = await storage.list({ limit: limit - rt.length, reverse: true, noCache: true, allowConcurrency: true, prefix });
                listCalls++;
                for (const [ key, value ] of map) {
                    if (typeof value !== 'string' || !isValidSortKey(value)) throw new Error(`Unexpected index record: ${JSON.stringify({ key, value })}`);
                    const timestamp = value.substring(0, 15);
                    if (timestamp < windowStartTimestamp) continue;
                    if (startTimestamp && timestamp < startTimestamp) continue;
                    if (startAfterTimestamp && timestamp <= startAfterTimestamp) continue;
                    if (endTimestamp && timestamp >= endTimestamp) continue;
                    rt.push(value);
                    if (rt.length >= limit) return rt;
                }
                date = addDaysToDateString(date, -1);
            }
            return rt;
        } else {
            // start at start date (or window start) and work forward
            const currentDate = now.substring(0, 10);
            let date = maxString(now, startTimeInclusive ?? startTimeExclusive ?? windowStartDate).substring(0, 10);
            let listCalls = 0;
            while (date <= currentDate) {
                const datestamp = computeTimestamp(`${date}T00:00:00.000Z`).substring(0, 6);
                const indexValuePrefix = dayUrlIndexDef[2](urlStartsWith, datestamp);
                const prefix = `hits.i0.${IndexId.DayUrl}.${indexValuePrefix}`;
                if (listCalls >= maxListCalls) throw new Error(`Max list calls!`);
                const map = await storage.list({ limit: limit - rt.length, reverse: false, noCache: true, allowConcurrency: true, prefix });
                listCalls++;
                for (const [ key, value ] of map) {
                    if (typeof value !== 'string' || !isValidSortKey(value)) throw new Error(`Unexpected index record: ${JSON.stringify({ key, value })}`);
                    const timestamp = value.substring(0, 15);
                    if (timestamp < windowStartTimestamp) continue;
                    if (startTimestamp && timestamp < startTimestamp) continue;
                    if (startAfterTimestamp && timestamp <= startAfterTimestamp) continue;
                    if (endTimestamp && timestamp >= endTimestamp) continue;
                    rt.push(value);
                    if (rt.length >= limit) return rt;
                }
                date = addDaysToDateString(date, 1);
            }
            return rt;
        }
    } else {
        throw new Error(`Unsupported request: ${JSON.stringify(request)}`);
    }
}
