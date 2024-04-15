import { check, checkMatches } from '../check.ts';
import { PackedRedirectLogsResponse, QueryPackedRedirectLogsRequest, Unkinded } from '../rpc_model.ts';
import { computeLinestream } from '../streams.ts';
import { addMinutes, computeTimestamp, isValidTimestamp, timestampToInstant, addDaysToDateString } from '../timestamp.ts';
import { maxString, minString } from '../collections.ts';
import { AttNums } from './att_nums.ts';
import { Blobs } from './blobs.ts';
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

export async function queryPackedRedirectLogsFromHits(request: Unkinded<QueryPackedRedirectLogsRequest>, opts: { hitsBlobs: Blobs, attNums: AttNums, indexSortKeys: string[] | undefined, descending: boolean, backupBlobs?: Blobs, quiet?: boolean }): Promise<PackedRedirectLogsResponse> {
    const { limit, startTimeInclusive, startTimeExclusive, endTimeExclusive, startAfterRecordKey } = request;
    const { hitsBlobs, attNums, indexSortKeys, descending, backupBlobs, quiet } = opts;
    const records: Record<string, string> = {}; // sortKey(timestamp-uuid) -> packed record

    const indexSortKeySet = indexSortKeys ? new Set(indexSortKeys) : undefined;
    const indexMinuteTimestamps = indexSortKeys ? new Set(indexSortKeys.map(v => computeMinuteTimestamp(v))) : undefined;
    if (indexMinuteTimestamps && indexMinuteTimestamps.size > maxMinutefileReadsPerRequest) {
        throw new Error(`Your query is too expensive, try setting the 'limit' closer to ${maxMinutefileReadsPerRequest}.`);
    }

    const startTimeInclusiveTimestamp = startTimeInclusive ? computeTimestamp(startTimeInclusive) : undefined;
    const startTimeExclusiveTimestamp = startTimeExclusive ? computeTimestamp(startTimeExclusive) : undefined;
    const endTimeExclusiveTimestamp = endTimeExclusive ? computeTimestamp(endTimeExclusive) : undefined;
    const endTimestamp = endTimeExclusiveTimestamp ?? computeTimestamp();

    const satisfyFromHits = async () => {
        const recordCount = Object.keys(records).length;
        let remaining = limit - recordCount;
        if (remaining === 0) return;

        const startMinuteTimestamp = maxString(computeTimestamp(hitsEpochMinute), computeMinuteTimestamp(startTimeExclusiveTimestamp ?? startTimeInclusiveTimestamp ?? computeTimestamp(indexSortKeys ? computeIndexWindowStartInstant() : hitsEpochMinute)));
        
        const endMinuteTimestamp = computeMinuteTimestamp(endTimestamp);
        const startAfterRecordKeyMinuteTimestamp = startAfterRecordKey ? computeMinuteTimestamp(unpackSortKey(startAfterRecordKey).timestamp) : undefined;

        if (descending) {
            // iterate hits minutefiles in descending order
            let minuteTimestamp = startAfterRecordKeyMinuteTimestamp ?? endMinuteTimestamp;
            while (minuteTimestamp >= startMinuteTimestamp && recordCount < limit) {
                if (!indexMinuteTimestamps || indexMinuteTimestamps.has(minuteTimestamp)) {
                    if (!quiet) console.log({ minuteTimestamp });
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
                            remaining--;
                            if (remaining === 0) return;
                        }
                    }
                }
                minuteTimestamp = computeTimestamp(addMinutes(timestampToInstant(minuteTimestamp), -1));
            }
        } else {
            // iterate hits minutefiles in ascending order
            let minuteTimestamp = startAfterRecordKeyMinuteTimestamp ?? startMinuteTimestamp;
            while (minuteTimestamp <= endMinuteTimestamp && recordCount < limit) {
                if (!indexMinuteTimestamps || indexMinuteTimestamps.has(minuteTimestamp)) {
                    if (!quiet) console.log({ minuteTimestamp });
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
                            remaining--;
                            if (remaining === 0) return;
                        }
                    }
                }
                minuteTimestamp = computeTimestamp(addMinutes(timestampToInstant(minuteTimestamp), 1));
            }
        }
    };

    const satisfyFromBackups = async () => {
        if (indexSortKeys !== undefined) return; // only applicable for queries with no filters
        if (!backupBlobs) return;

        const recordCount = Object.keys(records).length;
        let remaining = limit - recordCount;
        if (remaining === 0) return;

        type Hitmap = { packedKeys: string[] };
        const hitmaps = new Map<string, Hitmap>();
        const findDailyBackups = async (date: string): Promise<BackupKey[]> => {
            const month = date.substring(0, 7);
            if (!hitmaps.has(month)) {
                if (!quiet) console.log(`Getting hitmap for ${month}...`);
                const hitmap = await backupBlobs.get(`hitmaps/1/daily/${month}.json`, 'json') as Hitmap ?? { packedKeys: [] };
                hitmaps.set(month, hitmap);
            }
            const packedKeys = [...hitmaps.get(month)!.packedKeys];
            packedKeys.sort();
            if (descending) packedKeys.reverse();
            return packedKeys.map(unpackBackupKey).filter(v => v.hour.startsWith(date));
        };

        if (descending) {
            // iterate hourly backups in descending order
            const startTime = minString(endTimeExclusive ?? maxBackupHour, maxBackupHour);
            const startHour = startTime.substring(0, 13);
            let date = startHour.substring(0, 10);
            const minBackupDate = minBackupHour.substring(0, 10);
            while (date >= minBackupDate) {
                const backupKeys = await findDailyBackups(date);
                for (const backupKey of backupKeys) {
                    const { hour } = backupKey;
                    if (hour > startHour) continue;
                    if (!quiet) console.log(`Getting record stream for ${hour}...`)
                    const stream = await backupBlobs.get(`hits/1/${packBackupKey(backupKey)}`, 'stream');
                    if (!stream) throw new Error(`Expected stream for ${JSON.stringify(backupKey)}`);
                    const reversed: [ string, string ][] = []; // this is much larger for backups, hmm
                    for await (const entry of yieldRecords(stream, attNums, undefined)) {
                        reversed.unshift(entry);
                    }
                    for await (const [ record, sortKey ] of reversed) {
                        const recordTimestamp = sortKey.substring(0, 15);
                        if (startTimeInclusiveTimestamp && recordTimestamp < startTimeInclusiveTimestamp) return;
                        if (startTimeExclusiveTimestamp && recordTimestamp <= startTimeExclusiveTimestamp) return;
                        if (startAfterRecordKey && sortKey >= startAfterRecordKey) continue;
                        if (endTimestamp && recordTimestamp >= endTimestamp) continue;

                        records[sortKey] = record;
                        remaining--;
                        if (remaining === 0) return;
                    }
                }
                date = addDaysToDateString(date, -1);
            }
        } else {
            // iterate hourly backups in ascending order
            const startTime = maxString(startTimeExclusive ?? startTimeInclusive ?? minBackupHour, minBackupHour);
            const startHour = startTime.substring(0, 13);
            let date = startHour.substring(0, 10);
            while (date < maxBackupHour) {
                const backupKeys = await findDailyBackups(date);
                for (const backupKey of backupKeys) {
                    const { hour } = backupKey;
                    if (hour < startHour) continue;
                    if (!quiet) console.log(`Getting record stream for ${hour}...`)
                    const stream = await backupBlobs.get(`hits/1/${packBackupKey(backupKey)}`, 'stream');
                    if (!stream) throw new Error(`Expected stream for ${JSON.stringify(backupKey)}`);
                    for await (const [ record, sortKey ] of yieldRecords(stream, attNums, undefined)) {
                        const recordTimestamp = sortKey.substring(0, 15);
                        if (startTimeInclusiveTimestamp && recordTimestamp < startTimeInclusiveTimestamp) continue;
                        if (startTimeExclusiveTimestamp && recordTimestamp <= startTimeExclusiveTimestamp) continue;
                        if (startAfterRecordKey && sortKey <= startAfterRecordKey) continue;
                        if (endTimestamp && recordTimestamp >= endTimestamp) return;

                        records[sortKey] = record;
                        remaining--;
                        if (remaining === 0) return;
                    }
                }
                date = addDaysToDateString(date, 1);
            }
        } 
    };

    if (descending) {
        await satisfyFromHits();
        await satisfyFromBackups();
    } else {
        await satisfyFromBackups();
        await satisfyFromHits();
    }

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

export function computeIndexWindowStartInstant(): string {
    // allow for querying 90 full days
    const today = new Date().toISOString().substring(0, 10);
    const startDate = addDaysToDateString(today, -91);
    return maxString(`${startDate}T00:00:00.000Z`, minIndexInstant);
}

//

const hitsEpochMinute = `2024-03-13T00:00:00.000Z`;
const minBackupHour = `2022-09-15T21:00:00.000Z`;
const maxBackupHour = `2024-03-31T23:00:00.000Z`;

const minIndexInstant = '2024-04-13T00:00:00.000Z';

const maxMinutefileReadsPerRequest = 100;

function computeMinuteTimestamp(timestamp: string): string {
    return `${timestamp.substring(0, 10)}00000`;
}
