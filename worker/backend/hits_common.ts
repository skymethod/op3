import { check, checkMatches } from '../check.ts';
import { PackedRedirectLogsResponse, QueryPackedRedirectLogsRequest, Unkinded } from '../rpc_model.ts';
import { computeLinestream } from '../streams.ts';
import { addMinutes, computeTimestamp, isValidTimestamp, timestampToInstant } from '../timestamp.ts';
import { AttNums } from './att_nums.ts';
import { Blobs } from './blobs.ts';

export function computeMinuteFileKey(minuteTimestamp: string): string {
    return `minutes/${minuteTimestamp}.txt`;
}

export function unpackMinuteFileKey(key: string): { minuteTimestamp: string } {
    const [ _, minuteTimestamp ] = checkMatches('key', key, /^minutes\/(\d{15})\.txt$/);
    return { minuteTimestamp };
}

export function computeRecordInfo(obj: Record<string, string>): { sortKey: string, minuteTimestamp: string } {
    const { timestamp, uuid } = obj;
    if (typeof timestamp !== 'string') throw new Error(`No timestamp! ${JSON.stringify(obj)}`);
    if (typeof uuid !== 'string') throw new Error(`No uuid! ${JSON.stringify(obj)}`);
    const sortKey = `${timestamp}-${uuid}`;
    const minuteTimestamp = computeMinuteTimestamp(timestamp);
    return { sortKey, minuteTimestamp };
}

export async function queryPackedRedirectLogsFromHits(request: Unkinded<QueryPackedRedirectLogsRequest>, hitsBlobs: Blobs, attNums: AttNums, sortKeys: string[] | undefined): Promise<PackedRedirectLogsResponse> {
    const { limit, startTimeInclusive, startTimeExclusive, endTimeExclusive = new Date().toISOString(), startAfterRecordKey } = request;
    const records: Record<string, string> = {}; // sortKey(timestamp-uuid) -> packed record

    const startTimeInclusiveTimestamp = startTimeInclusive ? computeTimestamp(startTimeInclusive) : undefined;
    const startTimeExclusiveTimestamp = startTimeExclusive ? computeTimestamp(startTimeExclusive) : undefined;
    const startMinuteTimestamp = computeMinuteTimestamp(startTimeExclusiveTimestamp ?? startTimeInclusiveTimestamp ?? computeTimestamp(epochMinute));
    const endTimestamp = computeTimestamp(endTimeExclusive);
    const endMinuteTimestamp = computeMinuteTimestamp(endTimestamp);
    const startAfterRecordKeyMinuteTimestamp = startAfterRecordKey ? computeMinuteTimestamp(unpackSortKey(startAfterRecordKey).timestamp) : undefined;

    await (async () => {
        let minuteTimestamp = startAfterRecordKeyMinuteTimestamp ?? startMinuteTimestamp;
        let recordCount = 0;
        while (minuteTimestamp < endMinuteTimestamp && recordCount < limit) {
            console.log({ minuteTimestamp });
            const stream = await hitsBlobs.get(computeMinuteFileKey(minuteTimestamp), 'stream');
            if (stream !== undefined) {
                for await (const [ record, sortKey ] of yieldRecords(stream, attNums, minuteTimestamp)) {
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
            minuteTimestamp = computeTimestamp(addMinutes(timestampToInstant(minuteTimestamp), 1));
        }
    })();

    return { kind: 'packed-redirect-logs', namesToNums: attNums.toJson(), records };
}

export async function* yieldRecords(stream: ReadableStream<Uint8Array>, attNums: AttNums, minuteTimestamp: string): AsyncGenerator<[ string, string], void, unknown> {
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
        if (recordMinuteTimestamp !== minuteTimestamp) throw new Error(`Bad minuteTimestamp ${recordMinuteTimestamp}, expected ${minuteTimestamp} ${JSON.stringify(obj)}`);
        yield [ record, sortKey ];
    }
}

//

const epochMinute = `2024-03-13T00:00:00.000Z`;

function unpackSortKey(sortKey: string): { timestamp: string, uuid: string} {
    const [ _, timestamp, uuid ] = checkMatches('sortKey', sortKey, /^(\d{15})-([0-9a-f]{32})$/);
    check('sortKey', sortKey, isValidTimestamp(timestamp));
    return { timestamp, uuid };
}

function computeMinuteTimestamp(timestamp: string): string {
    return `${timestamp.substring(0, 10)}00000`;
}
