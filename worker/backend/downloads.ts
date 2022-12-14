import { computeChainDestinationUrl } from '../chain_estimate.ts';
import { check, checkAll, checkMatches, isValidDate, isValidInstant } from '../check.ts';
import { computeServerUrl } from '../client_params.ts';
import { Bytes, sortBy, distinct, DelimiterStream } from '../deps.ts';
import { DoNames } from '../do_names.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { findPublicSuffix } from '../public_suffixes.ts';
import { estimateByteRangeSize, tryParseRangeHeader } from '../range_header.ts';
import { RpcClient } from '../rpc_model.ts';
import { executeWithRetries } from '../sleep.ts';
import { yieldTsvFromStream } from '../streams.ts';
import { addHours, timestampToInstant } from '../timestamp.ts';
import { computeUserAgentEntityResult } from '../user_agents.ts';
import { isValidUuid } from '../uuid.ts';
import { AttNums } from './att_nums.ts';
import { Blobs, Multiput } from './blobs.ts';
import { computeBotType } from './bots.ts';
import { isRetryableErrorFromR2 } from './r2_bucket_blobs.ts';

export async function computeHourlyDownloads(hour: string, { statsBlobs, rpcClient, maxQueries, querySize, maxHits }: { statsBlobs: Blobs, rpcClient: RpcClient, maxQueries: number, querySize: number, maxHits: number }) {
    const start = Date.now();

    const startInstant = `${hour}:00:00.000Z`;
    if (!isValidInstant(startInstant)) throw new Error(`Bad hour: ${hour}`);
    const endInstant = addHours(startInstant, 1).toISOString();
    let startAfterRecordKey: string | undefined;
    type DownloadInfo = { chunkIndex?: number, isFirstTwoBytes?: boolean };
    const downloads: Record<string, DownloadInfo> = {};
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    chunks.push(encoder.encode(['serverUrl', 'audienceId', 'time', 'hashedIpAddress', 'agentType', 'agentName', 'deviceType', 'deviceName', 'referrerType', 'referrerName', 'countryCode', 'continentCode', 'regionCode', 'regionName', 'timezone', 'metroCode', 'asn', 'tags' ].join('\t') + '\n'));
    let queries = 0;
    let hits = 0;
    while (true) {
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
            const { method, range, ulid: _, url, hashedIpAddress: packedHashedIpAddress, userAgent, referer, timestamp, encryptedIpAddress: __, 'other.country': countryCode, 'other.continent': continentCode, 'other.regionCode': regionCode, 'other.region': regionName, 'other.timezone': timezone, 'other.metroCode': metroCode, 'other.asn': asn } = obj;
            if (method !== 'GET') continue; // ignore all non-GET requests
            const ranges = range ? tryParseRangeHeader(range) : undefined;
            const isFirstTwoBytes = ranges && ranges.length === 1 && 'start' in ranges[0] && ranges[0].start === 0 && ranges[0].end === 1; // bytes=0-1
            if (!isFirstTwoBytes && ranges && !ranges.some(v => estimateByteRangeSize(v) > 2)) continue; // ignore all other range requests that don't include a range of more than two bytes
            const serverUrl = computeServerUrl(url);
            const destinationServerUrl = computeChainDestinationUrl(serverUrl);
            if (destinationServerUrl === undefined) continue;
            const hashedIpAddress = typeof packedHashedIpAddress === 'string' ? unpackHashedIpAddressHash(packedHashedIpAddress) : undefined;
            const audienceId = (await Bytes.ofUtf8(`${hashedIpAddress}|${userAgent ?? ''}|${referer ?? ''}`).sha256()).hex();
            // TODO: how to incorporate ulids into audienceId? not a good replacement for ip address since they cannot be used across urls, and not a good suffix since a single download session across multiple ips would create dup downloads => ignore for now
            const download = `${destinationServerUrl}|${audienceId}`;
            const existing = downloads[download];
            if (existing) {
                if (existing.isFirstTwoBytes && typeof existing.chunkIndex === 'number' && !isFirstTwoBytes) {
                    // allow any larger request to replace a prior bytes=0-1 request for this download
                    chunks.splice(existing.chunkIndex, 1);
                } else {
                    // duplicate download, ignore
                    continue;
                }
            }
            // TODO: do the ip tagging here
            const time = timestampToInstant(timestamp);
            const result = userAgent ? computeUserAgentEntityResult(userAgent, referer) : undefined;
            const agentType = result?.type === 'library' && result.category === 'bot' ? 'bot-library' : (result?.type ?? 'unknown');
            const agentName = result?.name ?? userAgent;
            const deviceType = result?.device?.category;
            const deviceName = result?.device?.name;
            const referrerType = result?.type === 'browser' ? (result?.referrer?.category ?? (referer ? 'domain' : undefined)) : undefined;
            const referrerName = result?.type === 'browser' ? (result?.referrer?.name ?? (referer ? (findPublicSuffix(referer, 1) ?? `unknown:[${referer}]`) : undefined)) : undefined;
            const tags = isFirstTwoBytes ? 'first-two' : undefined;
            const line = [ serverUrl, audienceId, time, hashedIpAddress, agentType, agentName, deviceType, deviceName, referrerType, referrerName, countryCode, continentCode, regionCode, regionName, timezone, metroCode, asn, tags ].map(v => v ?? '').join('\t') + '\n';
            const chunkIndex = chunks.length;
            chunks.push(encoder.encode(line));
            downloads[download] = { chunkIndex, isFirstTwoBytes };
        }
        if (entries.length < querySize || hits >= maxHits) {
            break;
        }
    }

    const { contentLength } = await write(chunks, v => statsBlobs.put(computeHourlyKey(hour), v));

    return { hour, maxQueries, querySize, maxHits, queries, hits, downloads: Object.keys(downloads).length, millis: Date.now() - start, contentLength };
}

export async function computeDailyDownloads(date: string, { multipartMode, partSizeMb, statsBlobs, lookupShow } : { multipartMode: 'bytes' | 'stream', partSizeMb: number, statsBlobs: Blobs, lookupShow: (url: string) => Promise<{ showUuid: string, episodeId?: string } | undefined> }) {
    const start = Date.now();

    if (!isValidDate(date)) throw new Error(`Bad date: ${date}`);

    const lookupShowCached = (function() {
        const cache = new Map<string, { showUuid?: string, episodeId?: string }>();
        return async (url: string) => {
            const existing = cache.get(url);
            if (existing) return existing;
            const result = await lookupShow(url);
            cache.set(url, result ?? {});
            return result ?? {};
        }
    })();

    let hours = 0;
    let rows = 0;
    const downloads = new Set<string>();
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let chunksLength = 0;
    let totalContentLength = 0;
    let rowIndex = 0;
    const showMaps = new Map<string, ShowMap>();
    const headerChunk = encoder.encode(['time', 'episodeId', 'botType', 'serverUrl', 'audienceId', 'showUuid', 'hashedIpAddress', 'agentType', 'agentName', 'deviceType', 'deviceName', 'referrerType', 'referrerName', 'countryCode', 'continentCode', 'regionCode', 'regionName', 'timezone', 'metroCode', 'asn', 'tags' ].join('\t') + '\n');
    chunks.push(headerChunk); chunksLength += headerChunk.length;
    const partSize = partSizeMb * 1024 * 1024;
    let multiput: Multiput | undefined;
    let multiputParts: string[] | undefined;
    let remainder: Uint8Array | undefined;

    const multiputCurrentChunks = async () => {
        if (multipartMode === 'bytes') {
            const payload = concatByteArrays(...chunks);
            await multiput!.putPart(payload);
        } else if (multipartMode === 'stream') {
            await write(chunks, v => multiput!.putPart(v));
        } else {
            throw new Error(`Bad multipartMode: ${multipartMode}`);
        }       
        const contentLength = chunksLength;
        totalContentLength += contentLength;
        multiputParts = multiputParts ?? [];
        multiputParts.push(`contentLength: ${contentLength}`);
        chunks.splice(0);
        chunksLength = 0;
        if (remainder) {
            chunks.push(remainder);
            chunksLength += remainder.length;
            remainder = undefined;
        }
    }
    for (let hourNum = 0; hourNum < 24; hourNum++) {
        const hour = `${date}T${hourNum.toString().padStart(2, '0')}`;
        const key = computeHourlyKey(hour);
        const stream = await statsBlobs.get(key, 'stream');
        if (!stream) continue;
        hours++;

        for await (const obj of yieldTsvFromStream(stream)) {
            rows++;
            const { serverUrl, audienceId, time, hashedIpAddress, agentType, agentName, deviceType, deviceName, referrerType, referrerName, countryCode, continentCode, regionCode, regionName, timezone, metroCode, asn, tags } = obj;
            if (serverUrl === undefined) throw new Error(`Undefined serverUrl`);
            if (audienceId === undefined) throw new Error(`Undefined audienceId`);
            if (agentType === undefined) throw new Error(`Undefined agentType`);

            const destinationServerUrl = computeChainDestinationUrl(serverUrl);
            if (destinationServerUrl === undefined) continue;

            const download = `${destinationServerUrl}|${audienceId}`;
            if (downloads.has(download)) continue;
            downloads.add(download);

            // associate download with a show & episode
            const { showUuid, episodeId } = await lookupShowCached(serverUrl);

            // associate download with bot type
            const botType = computeBotType({ agentType, agentName, deviceType, referrerName });

            const line = [ time, episodeId, botType, serverUrl, audienceId, showUuid, hashedIpAddress, agentType, agentName, deviceType, deviceName, referrerType, referrerName, countryCode, continentCode, regionCode, regionName, timezone, metroCode, asn, tags ].map(v => v ?? '').join('\t') + '\n';
            const chunk = encoder.encode(line);
            
            if ((chunksLength + chunk.length) > partSize) { // r2 multipart requires all but last part to be exactly the same size
                const append = partSize - chunksLength;
                chunks.push(chunk.slice(0, append));
                remainder = chunk.slice(append);
                chunksLength += append;
            } else {
                chunks.push(chunk);
                chunksLength += chunk.length;
            }
            rowIndex++;
           
            if (showUuid) {
                let showMap = showMaps.get(showUuid);
                if (!showMap) {
                    showMap = { rowIndexes: [ 0 ], contentLength: headerChunk.length }; // header row
                    showMaps.set(showUuid, showMap);
                }
                showMap.rowIndexes.push(rowIndex);
                showMap.contentLength += chunk.length;
            }
            if (chunksLength >= partSize) {
                if (!multiput) multiput = await statsBlobs.startMultiput(computeDailyKey(date));
                await multiputCurrentChunks();
            }
        }
    }

    let parts: number | undefined;
    let etag: string;
    if (multiput) {
        if (chunks.length > 0) await multiputCurrentChunks(); // flush remaining rows
        try {
            const res = await multiput.complete();
            parts = res.parts;
            etag = res.etag;
        } catch (e) {
            throw new Error(`v6, partSize: ${partSize}, multiputParts: ${(multiputParts ?? []).join(', ')}, e=${e.stack || e}`);
        }
    } else {
        const { contentLength, etag: combinedEtag } = await write(chunks, v => statsBlobs.put(computeDailyKey(date), v));
        totalContentLength = contentLength;
        etag = combinedEtag;
    }
    const map: DailyDownloadsMap = { date, etag, contentLength: totalContentLength, showMaps: Object.fromEntries(showMaps) };
    await statsBlobs.put(computeDailyMapKey(date), JSON.stringify(map));
    const showSizes = Object.fromEntries(sortBy([...showMaps].map(([ showUuid, v ]) => ([ showUuid, v.contentLength ])), v => v[1] as number).reverse());
    return { date, millis: Date.now() - start, hours, rows, downloads: downloads.size, contentLength: totalContentLength, showSizes, parts, multiputParts, multipartMode };
}

export type ComputeShowDailyDownloadsRequest = { date: string, mode: 'include' | 'exclude', showUuids: string[] };

export function tryParseComputeShowDailyDownloadsRequest({ operationKind, targetPath, parameters }: { operationKind: string, targetPath: string, parameters?: Record<string, string> }): ComputeShowDailyDownloadsRequest | undefined {
    if (targetPath === '/work/compute-show-daily-downloads' && operationKind === 'update' && parameters) {
        const { date, shows } = parameters;
        check('date', date, isValidDate);
        const [ _, modeStr, showsStr ] = checkMatches('shows', shows, /^(include|exclude)=(.*?)$/);
        const mode = modeStr === 'include' || modeStr === 'exclude' ? modeStr : undefined;
        if (!mode) throw new Error(`Bad shows: ${shows}`);
        const showUuids = showsStr.split(',').filter(v => v !== '');
        return { date, mode, showUuids };
    }
}

export async function computeShowDailyDownloads({ date, mode, showUuids }: ComputeShowDailyDownloadsRequest, statsBlobs: Blobs) {
    const start = Date.now();
    if (!isValidDate(date)) throw new Error(`Bad date: ${date}`);
    checkAll('showUuids', showUuids, isValidUuid);
    showUuids = distinct(showUuids);
    if (mode === 'include' && showUuids.length === 0) throw new Error(`Provide at least one show-uuid`);

    const mapText = await statsBlobs.get(computeDailyMapKey(date), 'text');
    if (!mapText) throw new Error(`No daily downloads map for ${date}`);
    const map = JSON.parse(mapText) as DailyDownloadsMap;

    if (mode === 'exclude') {
        showUuids = Object.keys(map.showMaps).filter(v => !showUuids.includes(v));
    }

    const stream = await statsBlobs.get(computeDailyKey(date), 'stream', { ifMatch: map.etag });
    if (!stream) throw new Error(`No daily downloads for ${date}`);

    const indexToShowUuids = new Map<number, string[]>();
    for (const [ showUuid, showMap ] of Object.entries(map.showMaps)) {
        for (const index of showMap.rowIndexes) {
            let showUuids = indexToShowUuids.get(index);
            if (!showUuids) {
                showUuids = [];
                indexToShowUuids.set(index, showUuids);
            }
            showUuids.push(showUuid);
        }
    }

    const newline = new Uint8Array([ '\n'.charCodeAt(0) ]);
    const allChunks = stream.pipeThrough(new DelimiterStream(newline));
    let index = 0;
    const showChunks: Record<string, Uint8Array[]> = {};
    for await (const chunk of allChunks) {
        const showUuids = indexToShowUuids.get(index);
        if (showUuids) {
            const chunkWithNewline = concatByteArrays(chunk, newline);
            for (const showUuid of showUuids) {
                let chunks = showChunks[showUuid];
                if (!chunks) {
                    chunks = [];
                    showChunks[showUuid] = chunks;
                }
                chunks.push(chunkWithNewline);
            }
        }
        index++;
    }

    await Promise.all(Object.entries(showChunks).map(([ showUuid, chunks ]) => write(chunks, v => {
        const expectedRows = map.showMaps[showUuid].rowIndexes.length;
        if (expectedRows !== chunks.length) throw new Error(`Expected ${expectedRows} rows for show ${showUuid}, found ${chunks.length}`);
        return statsBlobs.put(computeShowDailyKey({ date, showUuid }), v);
    })));

    return { date, mode, showUuids, millis: Date.now() - start };
}

export function computeShowDailyKey({ date, showUuid }: { date: string, showUuid: string }): string {
    return `downloads/show-daily/${showUuid}/${showUuid}-${date}.tsv`;
}

export function unpackShowDailyKey(key: string): { date: string, showUuid: string } {
    const [ _, showUuid, showUuid2, date ] = checkMatches('key', key, /^downloads\/show-daily\/(.*?)\/(.*?)-(.*?)\.tsv$/);
    check('key', key, showUuid === showUuid2 && isValidUuid(showUuid) && isValidDate(date));
    return { showUuid, date };
}

export function computeShowDailyKeyPrefix({ showUuid, datePart }: { showUuid: string, datePart?: string }): string {
   return datePart ? `downloads/show-daily/${showUuid}/${showUuid}-${datePart}` : `downloads/show-daily/${showUuid}/`;
}

export function computeHourlyKey(hour: string): string {
    return `downloads/hourly/${hour}.tsv`;
}

//

interface DailyDownloadsMap {
    readonly date: string;
    readonly contentLength: number;
    readonly etag: string;
    readonly showMaps: Record<string, ShowMap>;
}

interface ShowMap {
    readonly rowIndexes: number[];
    contentLength: number;
}

//

function computeDailyKey(date: string): string {
    return `downloads/daily/${date}.tsv`;
}

function computeDailyMapKey(date: string): string {
    return `downloads/daily/${date}.map.json`;
}

async function write(chunks: Uint8Array[], put: (stream: ReadableStream) => Promise<{ etag: string }>): Promise<{ contentLength: number, etag: string }> {
    const contentLength = chunks.reduce((a, b) => a + b.byteLength, 0);

    return await executeWithRetries(async () => { // the underlying bucket streaming puts are not retryable, but we can retry at this level
        // deno-lint-ignore no-explicit-any
        const { readable, writable } = new (globalThis as any).FixedLengthStream(contentLength);
        const putPromise = put(readable); // don't await!
        const writer = writable.getWriter();
        for (const chunk of chunks) {
            writer.write(chunk);
        }
        await writer.close();
        // await writable.close(); // will throw on cf
        const { etag } = await putPromise;
        return { contentLength, etag };
    }, { tag: 'writeDownloadChunks', isRetryable: isRetryableErrorFromR2, maxRetries: 2 });
}

function concatByteArrays(...arrays: Uint8Array[]): Uint8Array {
    const length = arrays.reduce((a, b) => a + b.byteLength, 0);
    const rt = new Uint8Array(length);
    let offset = 0;
    for (const array of arrays) {
        rt.set(array, offset);
        offset += array.byteLength;
    }
    return rt;
}
