import { computeChainDestinationUrl } from '../chain_estimate.ts';
import { check, checkAll, checkMatches, isValidDate, isValidInstant, tryParseUrl } from '../check.ts';
import { computeServerUrl } from '../client_params.ts';
import { Bytes, DelimiterStream, distinct, sortBy } from '../deps.ts';
import { DoNames } from '../do_names.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { findPublicSuffix } from '../public_suffixes.ts';
import { estimateByteRangeSize, tryParseRangeHeader } from '../range_header.ts';
import { PackedRedirectLogsResponse, QueryPackedRedirectLogsRequest, RpcClient, Unkinded } from '../rpc_model.ts';
import { executeWithRetries } from '../sleep.ts';
import { computeLinestream, yieldTsvFromStream } from '../streams.ts';
import { addHours, timestampToInstant } from '../timestamp.ts';
import { consoleInfo } from '../tracer.ts';
import { computeUserAgentEntityResult } from '../user_agents.ts';
import { isValidUuid } from '../uuid.ts';
import { AttNums } from './att_nums.ts';
import { Blobs, Multiput } from './blobs.ts';
import { computeBotType, isBotIpHash, isWebWidgetHostname } from './bots.ts';
import { queryPackedRedirectLogsFromHits } from './hits_common.ts';
import { isRetryableErrorFromR2 } from './r2_bucket_blobs.ts';
import { isValidPartition } from './show_controller_model.ts';

export function computeAgentInfo({ userAgent, referer }: { userAgent: string | undefined, referer: string | undefined }) {
    const result = userAgent ? computeUserAgentEntityResult(userAgent, referer) : undefined;
    const agentType = result?.type === 'library' && result.category === 'bot' ? 'bot-library' : (result?.type ?? 'unknown');
    const agentName = result?.name ?? userAgent;
    const deviceType = result?.device?.category;
    const deviceName = result?.device?.name;
    const referrerUrl = result?.type === 'browser' && referer ? tryParseUrl(referer) : undefined;
    const referrerType = result?.type === 'browser' ? (result?.referrer?.category ?? (referer ? 'domain' : undefined)) : undefined;
    const referrerName = result?.type === 'browser' ? (result?.referrer?.name ?? (referrerUrl ? (findPublicSuffix(referrerUrl, 1) ?? `unknown:[${referer}]`) : undefined)) : undefined;
    const isWebWidget = referrerUrl && isWebWidgetHostname(referrerUrl.hostname);
    return { agentType, agentName, deviceType, deviceName, referrerType, referrerName, isWebWidget };
}

// phase 1: query crl for an hour's worth of hits, save one hourly downloads blob (unassigned to shows)
export async function computeHourlyDownloads(hour: string, { statsBlobs, rpcClient, maxQueries, querySize, maxHits, target = DoNames.combinedRedirectLog, hitsBlobs }: { statsBlobs: Blobs, rpcClient: RpcClient, maxQueries: number, querySize: number, maxHits: number, target?: string, hitsBlobs?: Blobs }) {
    const start = Date.now();

    const query: (request: Unkinded<QueryPackedRedirectLogsRequest>) => Promise<PackedRedirectLogsResponse> = 
        target === 'hitsBlobs' && hitsBlobs ? (request => queryPackedRedirectLogsFromHits(request, { hitsBlobs, attNums: new AttNums(), indexSortKeys: undefined, descending: false, quiet: true }))
        : (request => rpcClient.queryPackedRedirectLogs(request, target));

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
        const { namesToNums, records } = await query({ limit: querySize, startTimeInclusive: startInstant, endTimeExclusive: endInstant, startAfterRecordKey });
        queries++;
        const attNums = new AttNums(namesToNums);
        const entries = Object.entries(records);
        for (const [ recordKey, record ] of entries) {
            if (hits >= maxHits) break;
            hits++;
            if (recordKey > (startAfterRecordKey ?? '')) startAfterRecordKey = recordKey;
            const obj = attNums.unpackRecord(record);
            const { method, range, ulid: _, xpsId, ipSource, url, hashedIpAddress: packedHashedIpAddress, userAgent, referer, timestamp, encryptedIpAddress: __, 'other.asn': asn } = obj;
            let { 'other.country': countryCode, 'other.continent': continentCode, 'other.regionCode': regionCode, 'other.region': regionName, 'other.timezone': timezone, 'other.metroCode': metroCode } = obj;
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

                    // adjust any existing chunk indexes after this one
                    for (const info of Object.values(downloads)) {
                        if (typeof info.chunkIndex === 'number' && info.chunkIndex > existing.chunkIndex) {
                            info.chunkIndex--;
                        }
                    }
                } else {
                    // duplicate download, ignore
                    continue;
                }
            }
            // tagging
            const time = timestampToInstant(timestamp);
            const date = time.substring(0, 10);
            const { agentType, agentName, deviceType, deviceName, referrerType, referrerName, isWebWidget } = computeAgentInfo({ userAgent, referer });
            let tags = isFirstTwoBytes ? 'first-two' : undefined;
            const streaming = typeof xpsId === 'string' && xpsId !== '' || agentName === 'AppleCoreMedia';
            if (streaming) tags = (tags ? `${tags},streaming` : 'streaming');
            if (isWebWidget) tags = (tags ? `${tags},web-widget` : 'web-widget');
            if (ipSource === 'x-forwarded-for') {
                tags = (tags ? `${tags},x-forwarded-for` : 'x-forwarded-for');
                countryCode = continentCode = regionCode = regionName = timezone = metroCode = ''; // geo atts no longer represent the listener
            } else if (ipSource === 'unknown-crosszone') {
                tags = (tags ? `${tags},unknown-crosszone` : 'unknown-crosszone');
            }
            if (hashedIpAddress && isBotIpHash({ hashedIpAddress, asn, agentName, deviceName, destinationServerUrl, regionCode, date })) tags = (tags ? `${tags},bot-ip` : 'bot-ip');

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

// phase 2: process a day's worth of hourly download blobs, compute final downloads and assign to zero or one shows, save as 24 associated column blobs (partitioned)
type ComputeHourlyShowColumnsOpts = { 
    date: string, startHour?: number, endHour?: number, partition?: string, partitions: Record<string, string>, skipWrite?: boolean, skipLookup?: boolean, skipDownloads?: boolean, hashAlg?: string, statsBlobs: Blobs, 
    lookupShow: (url: string) => Promise<{ showUuid: string, episodeId?: string } | undefined>
}

export async function computeHourlyShowColumns({ date, skipWrite, skipLookup, skipDownloads, hashAlg = 'SHA-1', statsBlobs, lookupShow , startHour = 0, endHour = 23, partition, partitions }: ComputeHourlyShowColumnsOpts) {
    const start = Date.now();
    if (!isValidDate(date)) throw new Error(`Bad date: ${date}`);
    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 || endHour < startHour) throw new Error(`Bad hours: ${startHour}-${endHour}`);

    const cache = new Map<string, { showUuid?: string, episodeId?: string }>();
    const lookupShowCached = (function() {
        return async (url: string) => {
            const existing = cache.get(url);
            if (existing) return existing;
            const result = await lookupShow(url);
            cache.set(url, result ?? {});
            return result ?? {};
        }
    })();

    const downloads = new Set<string>();
    let hashesPreloadMillis = 0;
    let hashesPreloaded = 0;
    if (startHour > 0) {
        const startPreload = Date.now();
        const loadHour = startHour - 1;
        const hour = `${date}T${loadHour.toString().padStart(2, '0')}`;
        const stream = await statsBlobs.get(computeHourlyDownloadHashesKey(hour, partition), 'stream');
        if (!stream) throw new Error(`Need ${hour} to start at ${startHour}`);
        for await (const line of computeLinestream(stream)) {
            if (line.length > 0) downloads.add(line);
        }
        hashesPreloadMillis = Date.now() - startPreload;
        hashesPreloaded = downloads.size;
    }
    const encoder = new TextEncoder();
    const hourlyColumns: Record<string, { contentLength: number, millis: number }> = {};
    const hourlyHashes: Record<string, { hashes: number, contentLength: number, millis: number }> = {};
    let hours = 0;
    let rows = 0;

    const emptyLine = encoder.encode(`\n`);
    const excludedLine = encoder.encode(`x\n`);

    for (let hourNum = startHour; hourNum <= endHour; hourNum++) {
        const hour = `${date}T${hourNum.toString().padStart(2, '0')}`;
        const tag = `computeHourlyShowColumns ${hour} ${startHour}-${endHour} ${hashAlg}${skipWrite ? ` skipWrite` : ''}${skipLookup ? ` skipLookup` : ''}`;
        consoleInfo('downloads', `${tag} start downloads=${downloads.size}`);
        const key = computeHourlyKey(hour);
        const stream = await statsBlobs.get(key, 'stream');
        if (!stream) continue;
        hours++;

        const chunks: Uint8Array[] = [];
        let chunksLength = 0;
      
        for await (const obj of yieldTsvFromStream(stream)) {
            rows++;
            const { serverUrl, audienceId, agentType } = obj;
            if (serverUrl === undefined) throw new Error(`Undefined serverUrl`);
            if (audienceId === undefined) throw new Error(`Undefined audienceId`);
            if (agentType === undefined) throw new Error(`Undefined agentType`);

            const destinationServerUrl = computeChainDestinationUrl(serverUrl);
            if (destinationServerUrl === undefined) {
                chunks.push(emptyLine); chunksLength++;
                continue;
            }

            if (skipLookup) {
                chunks.push(emptyLine); chunksLength++;
                continue;
            } else {
                // associate download with a show & episode
                const { showUuid, episodeId } = await lookupShowCached(serverUrl);
                if (partitions[showUuid ?? ''] !== partition) {
                    chunks.push(excludedLine); chunksLength += 2;
                    continue;
                }

                if (skipDownloads) {
                    chunks.push(emptyLine); chunksLength++;
                    continue;
                } else {
                    // optimized, affects CPU + mem limits if done naively
                    const arr1 = encoder.encode(destinationServerUrl)
                    const arr2 = encoder.encode(audienceId);
                    const arr = new Uint8Array(arr1.length + arr2.length);
                    arr.set(arr1);
                    arr.set(arr2, arr1.length);
                    const download = fastHex(new Uint8Array(await crypto.subtle.digest(hashAlg, arr)));
    
                    if (downloads.has(download)) {
                        chunks.push(excludedLine); chunksLength += 2;
                        continue;
                    }
                    downloads.add(download);

                    const chunk = showUuid ? encoder.encode(`${showUuid ?? ''}${episodeId ?? ''}\n`) : emptyLine;
                    chunks.push(chunk); chunksLength += chunk.length;
                }
            }
        }

        if (skipWrite) {
            hourlyColumns[hour] = { contentLength: chunksLength, millis: 0 };
        } else {
            const writeStart = Date.now();
            const { contentLength } = await write(chunks, v => statsBlobs.put(computeHourlyShowColumnKey(hour, partition), v));
            if (contentLength !== chunksLength) throw new Error(`Wrote ${contentLength} bytes of hashes, expected ${chunksLength}`);
            hourlyColumns[hour] = { contentLength, millis: Date.now() - writeStart };
        }
        if (!skipWrite && !skipDownloads && !skipLookup) {
            const writeHashesStart = Date.now();
            const hashChunks: Uint8Array[] = [];
            let hashChunksLengths = 0;
            // file must exist, write even if 0 downloads!
            for (const hash of downloads) {
                const chunk = encoder.encode(hash + '\n');
                hashChunks.push(chunk); hashChunksLengths += chunk.length;
            }
            const { contentLength } = await write(hashChunks, v => statsBlobs.put(computeHourlyDownloadHashesKey(hour, partition), v));
            if (contentLength !== hashChunksLengths) throw new Error(`Wrote ${contentLength} bytes of hashes, expected ${hashChunksLengths}`);
            hourlyHashes[hour] = { hashes: downloads.size, contentLength, millis: Date.now() - writeHashesStart };
        }
        consoleInfo('downloads', `${tag} finish: ${JSON.stringify(hourlyColumns[hour])}`);
    }
    return { date, startHour, endHour, partition, hashAlg, millis: Date.now() - start, hours, rows, downloads: downloads.size, hourlyColumns, hourlyHashes, cache: cache.size, hashesPreloadMillis, hashesPreloaded };
}

// phase 3: iterate over hourly download blobs, plus associated show columns, write out daily downloads blobs and show maps (partitioned)
export type ComputeDailyDownloadsRequest = { date: string, mode: 'include' | 'exclude', showUuids: string[], multipartMode: 'bytes' | 'stream', partSizeMb: number, partition?: string };

export function parseComputeShowDailyDownloadsRequest(date: string, parameters: Record<string, string>): ComputeDailyDownloadsRequest {
    const { 'part-size': partSizeStr = '20', 'multipart-mode': multipartModeStr, partition } = parameters; // in mb, 20mb is about 50,000 rows
    const partSizeMb = parseInt(partSizeStr);
    check('part-size', partSizeMb, partSizeMb >= 5); // r2 minimum multipart size
    const multipartMode = multipartModeStr === 'bytes' ? 'bytes' : multipartModeStr === 'stream' ? 'stream' : 'bytes';
    const { mode, showUuids } = parseIncludeExclude(parameters);
    if (partition !== undefined) check('partition', partition, isValidPartition);
    return { date, mode, showUuids, partSizeMb, multipartMode, partition };
}

export async function computeDailyDownloads({ date, mode, showUuids, multipartMode, partSizeMb, partition }: ComputeDailyDownloadsRequest, { statsBlobs, partitions } : { partitions: Record<string, string>, statsBlobs: Blobs }) {
    const start = Date.now();
    showUuids = checkIncludeExclude(mode, showUuids);

    if (!isValidDate(date)) throw new Error(`Bad date: ${date}`);

    let hours = 0;
    let rows = 0;
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
    const partitionShowUuid = computePartitionShowUuid(partition, partitions);

    const multiputCurrentChunks = async () => {
        if (multipartMode === 'bytes') {
            const payload = concatByteArrays(...chunks);
            await multiput!.putPart(payload.buffer as ArrayBuffer);
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

        const columnStream = await statsBlobs.get(computeHourlyShowColumnKey(hour, partition), 'stream');
        if (!columnStream) throw new Error(`Need show column for hour=${hour} partition=${partition}`);

        const columnLinestream = computeLinestream(columnStream).getReader();

        for await (const obj of yieldTsvFromStream(stream)) {
            rows++;
            const { serverUrl, audienceId, time, hashedIpAddress, agentType, agentName, deviceType, deviceName, referrerType, referrerName, countryCode, continentCode, regionCode, regionName, timezone, metroCode, asn, tags } = obj;
            if (serverUrl === undefined) throw new Error(`Undefined serverUrl`);
            if (audienceId === undefined) throw new Error(`Undefined audienceId`);
            if (agentType === undefined) throw new Error(`Undefined agentType`);

            const { value, done } = await columnLinestream.read();
            if (done) throw new Error(`Unexpected column end at row ${rows}`);

            if (value === 'x') continue;
            
            let showUuid: string | undefined;
            let episodeId: string | undefined;
            if (value.length > 0) {
                showUuid = value.substring(0, 32);
                episodeId = value.substring(32);
            }

            if (partitions[showUuid ?? ''] !== partition) continue;
            
            // associate download with bot type
            const botType = computeBotType({ agentType, agentName, deviceType, referrerName, tags, date });

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
           
            if (showUuid && (mode === 'include' ? showUuids.includes(showUuid) : !showUuids.includes(showUuid))) {
                let showMap = showMaps.get(showUuid);
                if (!showMap) {
                    showMap = { rowIndexes: [ 0 ], contentLength: headerChunk.length }; // header row
                    showMaps.set(showUuid, showMap);
                }
                if (partitionShowUuid === showUuid) {
                    showMap.allRows = (showMap.allRows ?? 2) + 1;
                } else {
                    showMap.rowIndexes.push(rowIndex);
                }
                showMap.contentLength += chunk.length;
            }
            if (chunksLength >= partSize) {
                if (!multiput) multiput = await statsBlobs.startMultiput(computeDailyKey(date, partition));
                await multiputCurrentChunks();
            }
        }
        const { value: _, done } = await columnLinestream.read();
        if (!done) throw new Error(`Expected column end`);
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
            throw new Error(`v6, partSize: ${partSize}, multiputParts: ${(multiputParts ?? []).join(', ')}, e=${(e as Error).stack || e}`);
        }
    } else {
        const { contentLength, etag: combinedEtag } = await write(chunks, v => statsBlobs.put(computeDailyKey(date, partition), v));
        totalContentLength = contentLength;
        etag = combinedEtag;
    }
    const map: DailyDownloadsMap = { date, etag, contentLength: totalContentLength, showMaps: Object.fromEntries(showMaps) };
    await statsBlobs.put(computeDailyMapKey(date, partition), JSON.stringify(map));
    const showSizes = Object.fromEntries(sortBy([...showMaps].map(([ showUuid, v ]) => ([ showUuid, v.contentLength ])), v => v[1] as number).reverse());
    return { date, millis: Date.now() - start, hours, rows, contentLength: totalContentLength, showSizes, parts, multiputParts, multipartMode, partitionShowUuid };
}

// phase 4: for a set of shows, write out show daily downloads, one per show (partitioned)
export type ComputeShowDailyDownloadsRequest = { date: string, mode: 'include' | 'exclude', showUuids: string[], partition?: string, partitions: Record<string, string> };

export function tryParseComputeShowDailyDownloadsRequest({ operationKind, targetPath, parameters }: { operationKind: string, targetPath: string, parameters?: Record<string, string> }): ComputeShowDailyDownloadsRequest | undefined {
    if (targetPath === '/work/compute-show-daily-downloads' && operationKind === 'update' && parameters) {
        const { date, partition, partitions: packedPartitions } = parameters;
        check('date', date, isValidDate);
        const { mode, showUuids } = parseIncludeExclude(parameters);
        if (partition !== undefined) check('partition', partition, isValidPartition);
        const partitions = unpackPartitions(packedPartitions);
        return { date, mode, showUuids, partition, partitions };
    }
}

export async function computeShowDailyDownloads({ date, mode, showUuids, partition, partitions }: ComputeShowDailyDownloadsRequest, statsBlobs: Blobs) {
    const start = Date.now();
    if (!isValidDate(date)) throw new Error(`Bad date: ${date}`);
    showUuids = checkIncludeExclude(mode, showUuids);
    const partitionShowUuid = computePartitionShowUuid(partition, partitions);

    const mapText = await statsBlobs.get(computeDailyMapKey(date, partition), 'text');
    if (!mapText) throw new Error(`No daily downloads map for ${date}`);
    const map = JSON.parse(mapText) as DailyDownloadsMap;

    if (mode === 'exclude') {
        showUuids = Object.keys(map.showMaps).filter(v => !showUuids.includes(v));
    }

    const stream = await statsBlobs.get(computeDailyKey(date, partition), 'stream', { ifMatch: map.etag });
    if (!stream) throw new Error(`No daily downloads for ${date}`);

    const indexToShowUuids = new Map<number, string[]>();
    for (const [ showUuid, showMap ] of Object.entries(map.showMaps)) {
        if (!showUuids.includes(showUuid)) continue;
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
    const expectedChunkStart = new TextEncoder().encode('202'); // take this out before 2030 :)
    for await (const chunk of allChunks) {
        if (index > 0 && chunk.length > 0 && !byteArrayStartsWith(chunk, expectedChunkStart)) throw new Error('[' + new TextDecoder().decode(chunk) + ']'); // ensure first char is not dropped, as found in https://github.com/denoland/deno_std/issues/3609
        const showUuids = partitionShowUuid ? [ partitionShowUuid ] : indexToShowUuids.get(index);
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
        const showMap = map.showMaps[showUuid];
        const expectedRows = showMap === undefined ? 2 /* header + empty line? */ : typeof showMap.allRows === 'number' ? showMap.allRows : showMap.rowIndexes.length;
        if (expectedRows !== chunks.length) throw new Error(`Expected ${expectedRows} rows for show ${showUuid}, found ${chunks.length}`);
        return statsBlobs.put(computeShowDailyKey({ date, showUuid }), v);
    })));

    return { date, mode, showUuids, partitionShowUuid, millis: Date.now() - start };
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

export function fastHex(bytes: Uint8Array): string {
    const rt: string[] = new Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        rt.push(hexDigits[bytes[i]]);
    }
    return rt.join('');
}

export function unpackPartitions(partitionsStr: string | undefined): Record<string, string> {
    const rt: Record<string, string> = {};
    for (const pair of (partitionsStr ?? '').split(',').map(v => v.trim()).filter(v => v.length > 0)) {
        const [ showUuid, partition ] = pair.split(':');
        rt[showUuid] = partition;
    }
    return rt;
}

export function packPartitions(partitions: Record<string, string>): string {
    return Object.entries(partitions).map(v => v.join(':')).join(',');
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
    allRows?: number; // what rowIndexes.length would have been, rowIndexes will be empty to save space
}

//

const hexDigits = [...Array(0x100).keys()].map(v => v.toString(16).padStart(2, '0'));

function computeHourlyShowColumnKey(hour: string, partition: string | undefined) {
    return `downloads/hourly/${hour}.show-column${typeof partition === 'string' ? `.${partition}` : ''}.txt`;
}

function computeHourlyDownloadHashesKey(hour: string, partition: string | undefined) {
    return `downloads/hourly/${hour}.hashes${typeof partition === 'string' ? `.${partition}` : ''}.txt`;
}

function computeDailyKey(date: string, partition: string | undefined): string {
    return `downloads/daily/${date}${typeof partition === 'string' ? `.${partition}` : ''}.tsv`;
}

function computeDailyMapKey(date: string, partition: string | undefined): string {
    return `downloads/daily/${date}${typeof partition === 'string' ? `.${partition}` : ''}.map.json`;
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

function byteArrayStartsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
    if (prefix.length === 0 || prefix.length > bytes.length) return false;
    for (let i = 0; i < prefix.length; i++) {
        if (bytes[i] !== prefix[i]) return false;
    }
    return true;
}

function parseIncludeExclude(parameters: Record<string, string>): { mode: 'include' | 'exclude', showUuids: string[] } {
    const { shows } = parameters;
    const [ _, modeStr, showsStr ] = checkMatches('shows', shows, /^(include|exclude)=(.*?)$/);
    const mode = modeStr === 'include' || modeStr === 'exclude' ? modeStr : undefined;
    if (!mode) throw new Error(`Bad shows: ${shows}`);
    const showUuids = showsStr.split(',').filter(v => v !== '');
    return { mode, showUuids };
}

function checkIncludeExclude(mode: 'include' | 'exclude', showUuids: string[]): string[] {
    checkAll('showUuids', showUuids, isValidUuid);
    showUuids = distinct(showUuids);
    if (mode === 'include' && showUuids.length === 0) throw new Error(`Provide at least one show-uuid`);
    return showUuids;
}

function computePartitionShowUuid(partition: string | undefined, partitions: Record<string, string>): string | undefined {
    if (partition === undefined) return undefined;
    if (Object.keys(partitions).length === 0) throw new Error(`Expected partitions for partition call`);
    return Object.entries(partitions).filter(v => v[1] === partition).length === 1 ? Object.entries(partitions).filter(v => v[1] === partition)[0][0] : undefined;
}
