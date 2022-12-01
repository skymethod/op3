import { isValidDate, isValidInstant } from '../check.ts';
import { computeServerUrl } from '../client_params.ts';
import { Bytes, TextLineStream, zip } from '../deps.ts';
import { DoNames } from '../do_names.ts';
import { findPublicSuffix } from '../public_suffixes.ts';
import { estimateByteRangeSize, tryParseRangeHeader } from '../range_header.ts';
import { RpcClient } from '../rpc_model.ts';
import { addHours, timestampToInstant } from '../timestamp.ts';
import { consoleWarn } from '../tracer.ts';
import { computeUserAgentEntityResult } from '../user_agents.ts';
import { AttNums } from './att_nums.ts';
import { Blobs } from './blobs.ts';

export async function computeHourlyDownloads(hour: string, { statsBlobs, go, rpcClient, maxQueries, querySize, maxHits }: { statsBlobs: Blobs, go: boolean, rpcClient: RpcClient, maxQueries: number, querySize: number, maxHits: number }) {
    const start = Date.now();

    const startInstant = `${hour}:00:00.000Z`;
    if (!isValidInstant(startInstant)) throw new Error(`Bad hour: ${hour}`);
    const endInstant = addHours(startInstant, 1).toISOString();
    let startAfterRecordKey: string | undefined;
    const downloads = new Set<string>();
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    chunks.push(encoder.encode(['serverUrl', 'audienceId', 'time', 'hashedIpAddress', 'encryptedIpAddress', 'agentType', 'agentName', 'deviceType', 'deviceName', 'referrerType', 'referrerName', 'countryCode', 'continentCode', 'regionCode', 'regionName', 'timezone', 'metroCode' ].join('\t') + '\n'));
    let queries = 0;
    let hits = 0;
    while (true && go) {
        if (queries >= maxQueries) break;
        const { namesToNums, records } = await rpcClient.queryPackedRedirectLogs({ limit: querySize, startTimeInclusive: startInstant, endTimeExclusive: endInstant, startAfterRecordKey }, DoNames.combinedRedirectLog);
        queries++;
        const attNums = new AttNums(namesToNums);
        const entries = Object.entries(records);
        for (const [ recordKey, record ] of entries) {
            if (hits >= maxHits) break;
            hits++;
            if (recordKey > (startAfterRecordKey ?? '')) startAfterRecordKey = recordKey;
            const obj = attNums.unpackRecord(record);
            const { method, range, ulid, url, hashedIpAddress, userAgent, referer, timestamp, encryptedIpAddress, 'other.country': countryCode, 'other.continent': continentCode, 'other.regionCode': regionCode, 'other.region': regionName, 'other.timezone': timezone, 'other.metroCode': metroCode } = obj;
            if (method !== 'GET') continue; // ignore all non-GET requests
            const ranges = range ? tryParseRangeHeader(range) : undefined;
            if (ranges && !ranges.some(v => estimateByteRangeSize(v) > 2)) continue; // ignore range requests that don't include a range of more than two bytes
            const serverUrl = computeServerUrl(url);
            const audienceId = (await Bytes.ofUtf8(`${hashedIpAddress}|${userAgent ?? ''}|${referer ?? ''}|${ulid ?? ''}`).sha256()).hex();
            const download = `${serverUrl}|${audienceId}`;
            if (downloads.has(download)) continue;
            const time = timestampToInstant(timestamp);
            const result = userAgent ? computeUserAgentEntityResult(userAgent, referer) : undefined;
            const agentType = result?.type ?? 'unknown';
            const agentName = result?.name ?? userAgent;
            const deviceType = result?.device?.category;
            const deviceName = result?.device?.name;
            const referrerType = result?.type === 'browser' ? (result?.referrer?.category ?? (referer ? 'domain' : undefined)) : undefined;
            const referrerName = result?.type === 'browser' ? (result?.referrer?.name ?? (referer ? (findPublicSuffix(referer, 1) ?? `unknown:[${referer}]`) : undefined)) : undefined;
            const line = [ serverUrl, audienceId, time, hashedIpAddress, encryptedIpAddress, agentType, agentName, deviceType, deviceName, referrerType, referrerName, countryCode, continentCode, regionCode, regionName, timezone, metroCode ].map(v => v ?? '').join('\t') + '\n';
            chunks.push(encoder.encode(line));
            downloads.add(download);
        }
        if (entries.length < querySize || hits >= maxHits) {
            break;
        }
    }
    
    let error: string | undefined;
    const contentLength = chunks.reduce((a, b) => a + b.byteLength, 0);
    try {
        // deno-lint-ignore no-explicit-any
        const { readable, writable } = new (globalThis as any).FixedLengthStream(contentLength);
        const key = computeHourlyKey(hour);
        const putPromise = statsBlobs.put(key, readable);
        const writer = writable.getWriter();
        for (const chunk of chunks) {
            writer.write(chunk);
        }
        await writer.close();
        // await writable.close(); // will throw on cf
        await putPromise;
    } catch (e) {
        consoleWarn('show-stats-hourly', `Error in close: ${e.stack || e}`);
        error = `${e.stack || e}`;
    }
    return { hour, maxQueries, querySize, maxHits, queries, hits, downloads: downloads.size, millis: Date.now() - start, error, contentLength };
}

export async function computeDailyDownloads(date: string, { statsBlobs } : { statsBlobs: Blobs }) {
    const start = Date.now();

    if (!isValidDate(date)) throw new Error(`Bad date: ${date}`);

    let hours = 0;
    let rows = 0;
    const downloads = new Set<string>();
    for (let hourNum = 0; hourNum < 24; hourNum++) {
        const hour = `${date}T${hourNum.toString().padStart(2, '0')}`;
        const key = computeHourlyKey(hour);
        const stream = await statsBlobs.get(key, 'stream');
        if (!stream) continue;
        hours++;
        const lines = stream
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new TextLineStream());

        let headers: string[] | undefined;
        for await (const line of lines) {
            const values = headers = line.split('\t');
            if (!headers) {
                headers = values;
                continue;
            }
            rows++;
            const { serverUrl, audienceId } = Object.fromEntries(zip(headers, values));
            const download = `${serverUrl}|${audienceId}`;
            if (downloads.has(download)) continue;
            downloads.add(download);
        }
    }
    return { millis: Date.now() - start, hours, rows, downloads: downloads.size, date };
}

//

function computeHourlyKey(hour: string): string {
    return `downloads/hourly/${hour}.tsv`;
}
