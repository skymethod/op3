import { check, checkMatches } from '../check.ts';
import { PackedRedirectLogsResponse, QueryPackedRedirectLogsRequest, Unkinded } from '../rpc_model.ts';
import { computeLinestream } from '../streams.ts';
import { addMinutes, computeTimestamp, isValidTimestamp, timestampToInstant } from '../timestamp.ts';
import { AttNums } from './att_nums.ts';
import { Blobs } from './blobs.ts';
import { computeIndexWindowStartInstant } from './hits_indexes.ts';
import { unpackBackupKey, BackupKey, packBackupKey } from './backups.ts';

export function computeMinuteFileKey(minuteTimestamp: string): string {
    return `minutes/${minuteTimestamp}.txt`;
}

export function unpackMinuteFileKey(key: string): { minuteTimestamp: string } {
    const [ _, minuteTimestamp ] = checkMatches('key', key, /^minutes\/(\d{15})\.txt$/);
    return { minuteTimestamp };
}

export function computeRecordInfo(obj: Record<string, string>): { sortKey: string, minuteTimestamp: string, timestamp: string } {
    const { timestamp, uuid } = obj;
    if (typeof timestamp !== 'string') throw new Error(`No timestamp! ${JSON.stringify(obj)}`);
    if (typeof uuid !== 'string') throw new Error(`No uuid! ${JSON.stringify(obj)}`);
    const sortKey = `${timestamp}-${uuid}`;
    const minuteTimestamp = computeMinuteTimestamp(timestamp);
    return { sortKey, minuteTimestamp, timestamp };
}

export async function queryPackedRedirectLogsFromHits(request: Unkinded<QueryPackedRedirectLogsRequest>, opts: { hitsBlobs: Blobs, attNums: AttNums, indexSortKeys: string[] | undefined, descending: boolean, backupBlobs?: Blobs }): Promise<PackedRedirectLogsResponse> {
    const { limit, startTimeInclusive, startTimeExclusive, endTimeExclusive = new Date().toISOString(), startAfterRecordKey } = request;
    const { hitsBlobs, attNums, indexSortKeys, descending, backupBlobs } = opts;
    const records: Record<string, string> = {}; // sortKey(timestamp-uuid) -> packed record

    const startTimeInclusiveTimestamp = startTimeInclusive ? computeTimestamp(startTimeInclusive) : undefined;
    const startTimeExclusiveTimestamp = startTimeExclusive ? computeTimestamp(startTimeExclusive) : undefined;
    const startMinuteTimestamp = computeMinuteTimestamp(startTimeExclusiveTimestamp ?? startTimeInclusiveTimestamp ?? computeTimestamp(indexSortKeys ? computeIndexWindowStartInstant() : hitsEpochMinute));
    const endTimestamp = computeTimestamp(endTimeExclusive);
    const endMinuteTimestamp = computeMinuteTimestamp(endTimestamp);
    const startAfterRecordKeyMinuteTimestamp = startAfterRecordKey ? computeMinuteTimestamp(unpackSortKey(startAfterRecordKey).timestamp) : undefined;

    const indexSortKeySet = indexSortKeys ? new Set(indexSortKeys) : undefined;
    const indexMinuteTimestamps = indexSortKeys ? new Set(indexSortKeys.map(v => computeMinuteTimestamp(v))) : undefined;

    // try to satisfy from hits
    await (async () => {
        if (descending) {
            let minuteTimestamp = startAfterRecordKeyMinuteTimestamp ?? endMinuteTimestamp;
            let recordCount = 0;
            while (minuteTimestamp >= startMinuteTimestamp && recordCount < limit) {
                if (!indexMinuteTimestamps || indexMinuteTimestamps.has(minuteTimestamp)) {
                    console.log({ minuteTimestamp });
                    const stream = await hitsBlobs.get(computeMinuteFileKey(minuteTimestamp), 'stream');
                    if (stream !== undefined) {
                        const reversed: [ string, string ][] = [];
                        for await (const entry of yieldRecords(stream, attNums, minuteTimestamp)) {
                            reversed.unshift(entry);
                        }
                        for await (const [ record, sortKey ] of reversed) {
                            if (indexSortKeySet && !indexSortKeySet.has(sortKey)) continue;
                            const recordTimestamp = sortKey.substring(0, 15);
                            if (startTimeInclusiveTimestamp && recordTimestamp < startTimeInclusiveTimestamp) return;
                            if (startTimeExclusiveTimestamp && recordTimestamp <= startTimeExclusiveTimestamp) return;
                            if (startAfterRecordKey && sortKey >= startAfterRecordKey) continue;
                            if (endTimestamp && recordTimestamp >= endTimestamp) continue;
                            records[sortKey] = record;
                            recordCount++;
                            if (recordCount >= limit) return;
                        }
                    }
                }
                minuteTimestamp = computeTimestamp(addMinutes(timestampToInstant(minuteTimestamp), -1));
            }
        } else {
            let minuteTimestamp = startAfterRecordKeyMinuteTimestamp ?? startMinuteTimestamp;
            let recordCount = 0;
            while (minuteTimestamp <= endMinuteTimestamp && recordCount < limit) {
                if (!indexMinuteTimestamps || indexMinuteTimestamps.has(minuteTimestamp)) {
                    console.log({ minuteTimestamp });
                    const stream = await hitsBlobs.get(computeMinuteFileKey(minuteTimestamp), 'stream');
                    if (stream !== undefined) {
                        for await (const [ record, sortKey ] of yieldRecords(stream, attNums, minuteTimestamp)) {
                            if (indexSortKeySet && !indexSortKeySet.has(sortKey)) continue;
                            const recordTimestamp = sortKey.substring(0, 15);
                            if (startTimeInclusiveTimestamp && recordTimestamp < startTimeInclusiveTimestamp) continue;
                            if (startTimeExclusiveTimestamp && recordTimestamp <= startTimeExclusiveTimestamp) continue;
                            if (startAfterRecordKey && sortKey <= startAfterRecordKey) continue;
                            if (endTimestamp && recordTimestamp >= endTimestamp) return;
                            records[sortKey] = record;
                            recordCount++;
                            if (recordCount >= limit) return;
                        }
                    }
                }
                minuteTimestamp = computeTimestamp(addMinutes(timestampToInstant(minuteTimestamp), 1));
            }
        }
    })();

    // enrich with old crl backups if applicable (before the hits epoch, and not using new indexes)
    // await (async () => {
    //     if (indexSortKeys === undefined && backupBlobs) {
    //         const { limit } = request;
    //         const recordCount = Object.keys(records).length;
    //         let remaining = limit - recordCount;
    //         if (remaining > 0) {
    //             if (descending) {

    //             } else {
    //                 const date = backupEpochHour.substring(0, 10);
    //                 const backupKeys = await findDailyBackups(date, backupBlobs, descending);
    //                 for (const backupKey of backupKeys) {
    //                     const stream = await backupBlobs.get(`hits/1/${packBackupKey(backupKey)}`, 'stream');
    //                     if (!stream) throw new Error(`Expected stream for ${JSON.stringify(backupKey)}`);
    //                     for await (const [ record, sortKey ] of yieldRecords(stream, attNums, undefined)) {
    //                         // TODO apply query filters
    //                         records[sortKey] = record;
    //                         remaining--;
    //                         if (remaining === 0) return;
    //                     }
    //                 }
    //                 // TODO next day
    //             }
    //         }
    //     }
    // })();

    return { kind: 'packed-redirect-logs', namesToNums: attNums.toJson(), records };
}

export async function* yieldRecords(stream: ReadableStream<Uint8Array>, attNums: AttNums, minuteTimestamp: string | undefined): AsyncGenerator<[ string, string ], void, unknown> {
    let fileAttNums: AttNums | undefined;
    let repack = false;
    for await (const line of computeLinestream(stream)) {
        if (line === '') continue;
        if (!fileAttNums) {
            fileAttNums = AttNums.fromJson(JSON.parse(line));
            repack = !fileAttNums.isSubsetOf(attNums);
            continue;
        }
        const obj = fileAttNums.unpackRecord(line);
        const record = repack ? attNums.packRecord(obj) : line;
        const { sortKey, minuteTimestamp: recordMinuteTimestamp } = computeRecordInfo(obj);
        if (minuteTimestamp !== undefined && recordMinuteTimestamp !== minuteTimestamp) throw new Error(`Bad minuteTimestamp ${recordMinuteTimestamp}, expected ${minuteTimestamp} ${JSON.stringify(obj)}`);
        yield [ record, sortKey ];
    }
}

export function unpackSortKey(sortKey: string): { timestamp: string, uuid: string} {
    const [ _, timestamp, uuid ] = checkMatches('sortKey', sortKey, /^(\d{15})-([0-9a-f]{32})$/);
    check('sortKey', sortKey, isValidTimestamp(timestamp));
    return { timestamp, uuid };
}

export function isValidSortKey(sortKey: string): boolean {
    const m = /^(\d{15})-([0-9a-f]{32})$/.exec(sortKey);
    return !!m && isValidTimestamp(m[1]);
}

//

const hitsEpochMinute = `2024-03-13T00:00:00.000Z`;
const backupEpochHour = `2022-09-15T21:00:00.000Z`;

function computeMinuteTimestamp(timestamp: string): string {
    return `${timestamp.substring(0, 10)}00000`;
}

async function findDailyBackups(date: string, backupBlobs: Blobs, descending: boolean): Promise<BackupKey[]> {
    const dailyBackupKeysByHour: Record<string, BackupKey> = {};
    const { keys } = await backupBlobs.list({ keyPrefix: `hits/1/${date}T` });
    for (const backupKey of keys.map(v => v.substring('hits/1'.length)).map(unpackBackupKey)) {
        const { hour, timestamp, tag } = backupKey;
        if (tag !== 'daily') continue;
        const existing = dailyBackupKeysByHour[hour];
        if (!existing || existing.timestamp < timestamp) dailyBackupKeysByHour[hour] = backupKey;
    }
    const hours = Object.keys(dailyBackupKeysByHour);
    if (descending) hours.reverse();
    return hours.map(v => dailyBackupKeysByHour[v]);
}
