import { computeChainDestinationUrl } from '../chain_estimate.ts';
import { check, checkMatches, isString, isStringRecord, isValidGuid, isValidHttpUrl, tryParseInt, tryParseJson } from '../check.ts';
import { isValidSha256Hex } from '../crypto.ts';
import { Bytes, chunk, distinct, DurableObjectStorage, DurableObjectStorageValue, sortBy } from '../deps.ts';
import { equalItunesCategories, Item, parseFeed, stringifyItunesCategories } from '../feed_parser.ts';
import { fetchOp3RedirectUrls, hasOp3Reference, isRedirectFetchingRequired } from '../fetch_redirects.ts';
import { computeUserAgent } from '../outbound.ts';
import { PodcastIndexClient } from '../podcast_index_client.ts';
import { AdminDataRequest, AdminDataResponse, AlarmPayload, ExternalNotificationRequest, RpcClient, Unkinded } from '../rpc_model.ts';
import { addHours, computeStartOfYearTimestamp, computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { consoleInfo, consoleWarn, writeTraceEvent } from '../tracer.ts';
import { cleanUrl, computeMatchUrl, tryCleanUrl, tryComputeIncomingUrl, tryComputeMatchUrl } from '../urls.ts';
import { generateUuid, isValidUuid } from '../uuid.ts';
import { tryMakeXfetcher } from '../xfetcher.ts';
import { Backups } from './backups.ts';
import { Blobs } from './blobs.ts';
import { computeDailyDownloads, computeHourlyDownloads, computeHourlyShowColumns, parseComputeShowDailyDownloadsRequest } from './downloads.ts';
import { computeShowListenStatsKey, isValidShowListenStats } from './listens.ts';
import { computeFetchInfo, tryParseBlobKey } from './show_controller_feeds.ts';
import { EpisodeRecord, FeedItemIndexRecord, FeedItemRecord, FeedRecord, FeedWorkRecord, getHeader, isEpisodeRecord, isFeedItemIndexRecord, isFeedItemRecord, isFeedRecord, isMediaUrlIndexRecord, isShowgroupRecord, isShowPartitionsRecord, isShowRecord, isValidPartition, isValidShowgroupId, isWorkRecord, MediaUrlIndexRecord, PodcastIndexFeed, ShowEpisodesByPubdateIndexRecord, ShowgroupRecord, ShowPartitionsRecord, ShowRecord, WorkRecord } from './show_controller_model.ts';
import { ShowControllerNotifications } from './show_controller_notifications.ts';
import { computeListOpts } from './storage.ts';

export class ShowController {
    static readonly processAlarmKind = 'ShowController.processAlarmKind';

    private readonly storage: DurableObjectStorage;
    private readonly durableObjectName: string;
    private readonly podcastIndexClient: PodcastIndexClient;
    private readonly notifications: ShowControllerNotifications;
    private readonly origin: string;
    private readonly feedBlobs: Blobs;
    private readonly statsBlobs: Blobs;
    private readonly rpcClient: RpcClient;
    private readonly backups = new Backups();
    private readonly podcastGuidCallState: PodcastGuidCallState = {};
    private readonly allowStorageImport: boolean;
    private readonly xfetcher?: string;

    constructor({ storage, durableObjectName, podcastIndexClient, origin, feedBlobs, statsBlobs, rpcClient, allowStorageImport, xfetcher }: { storage: DurableObjectStorage, durableObjectName: string, podcastIndexClient: PodcastIndexClient, origin: string, feedBlobs: Blobs, statsBlobs: Blobs, rpcClient: RpcClient, allowStorageImport: boolean, xfetcher: string | undefined }) {
        this.storage = storage;
        this.durableObjectName = durableObjectName;
        this.podcastIndexClient = podcastIndexClient;
        this.origin = origin;
        this.feedBlobs = feedBlobs;
        this.statsBlobs = statsBlobs;
        this.rpcClient = rpcClient;
        this.allowStorageImport = allowStorageImport;
        this.xfetcher = xfetcher;
        this.notifications = new ShowControllerNotifications(storage, origin);
        this.notifications.callbacks = {
            onPodcastGuids: async podcastGuids => {
                // for guids we've never seen before, insert pending index records and enqueue lookup-pg work
                const newPodcastGuids = await computeNewPodcastGuids(podcastGuids, storage);
                if (newPodcastGuids.size === 0) return;
                consoleInfo('sc-on-pg', `ShowController: onPodcastGuids: ${[...newPodcastGuids].join(', ')}`);
                await savePodcastGuidIndexRecords(newPodcastGuids, storage);
                await enqueueWork([...newPodcastGuids].map(v => ({ uuid: generateUuid(), kind: 'lookup-pg', podcastGuid: v, attempt: 1 })), storage, durableObjectName);
            },
            onFeedUrls: async feedUrls => {
                // update associated feed records, and enqueue lookup-feed work if necessary
                const work: FeedWorkRecord[] = [];
                for (const batch of chunk([...feedUrls], 128)) {
                    const feedRecordIds = await Promise.all(batch.map(async v => await computeFeedRecordId(v)));
                    const keys = feedRecordIds.map(computeFeedRecordKey);
                    const map = await storage.get(keys);
                    const newRecords: Record<string, FeedRecord> = {};
                    for (let i = 0; i < keys.length; i++) {
                        const feedRecordId = feedRecordIds[i];
                        const key = keys[i];
                        const feedUrl = batch[i];
                        const existing = map.get(key);
                        if (existing) {
                            if (isFeedRecord(existing)) {
                                const { piCheckedInstant } = existing;
                                if (typeof piCheckedInstant !== 'string' || (Date.now() - new Date(piCheckedInstant).getTime()) > 1000 * 60 * 60 * 24) { // only recheck pi at most once a day
                                    work.push({ kind: 'lookup-feed', feedUrl, uuid: generateUuid(), attempt: 1 });
                                }
                            } else {
                                consoleWarn('sc-on-feed-urls', `ShowController: bad FeedRecord: ${JSON.stringify(existing)}`);
                            }
                        } else {
                            const created = new Date().toISOString();
                            const insert: FeedRecord = { id: feedRecordId, state: 'new', url: feedUrl, created, updated: created };
                            newRecords[key] = insert;
                            work.push({ kind: 'lookup-feed', feedUrl, uuid: generateUuid(), attempt: 1 });
                            consoleInfo('sc-on-feed-urls', `Inserted new FeedRecord: ${insert.url}`);
                        }
                    }
                    if (Object.keys(newRecords).length > 0) {
                        await storage.put(newRecords);
                    }
                }
                await enqueueWork(work, storage, durableObjectName);
            }
        }
    }

    async receiveExternalNotification({ notification, received } : Unkinded<ExternalNotificationRequest>): Promise<void> {
        await this.notifications.receiveExternalNotification({ notification, received });
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>, backupBlobs: Blobs | undefined, hitsBlobs: Blobs | undefined): Promise<Unkinded<AdminDataResponse>> {
        const { notifications, storage, origin, feedBlobs, allowStorageImport, xfetcher } = this;
        const res = await notifications.adminExecuteDataQuery(req);
        if (res) return res;

        const { operationKind, targetPath, parameters = {} } = req;

        if (operationKind === 'select' && targetPath === '/show/storage') {
            const map = await storage.list(computeListOpts('', parameters));
            const results = [ ...map ];
            return { results };
        }
        if (operationKind === 'select' && targetPath === '/show/feeds') {
            const map = await storage.list(computeListOpts('sc.fr0.', parameters));
            const results = [...map.values()].filter(isFeedRecord);
            return { results };
        }
        if (operationKind === 'select' && targetPath === '/show/shows') {
            const { lookup, lookupBulk } = parameters;
            if (typeof lookup === 'string') {
                const metrics = newLookupShowMetrics();
                const result = await lookupShow(lookup, storage, metrics);
                const results: unknown[] = [];
                if (result) {
                    const { showUuid, episodeId } = result;
                    const show = await storage.get(computeShowKey(showUuid));
                    if (!isShowRecord(show)) throw new Error(`Bad show record`);
                    results.push({ ...show, episodeId })
                }
                return { results, message: metrics.messages.join(', ') };
            }
            if (typeof lookupBulk === 'string') {
                const { lookupShow, matchUrls, querylessMatchUrls, preloadMillis, feedRecordIdsToShowUuids } = await lookupShowBulk(storage);
                const messages = [ JSON.stringify({ preloadMillis, matchUrls, querylessMatchUrls, feedRecordIdsToShowUuids }) ];
                const result = await lookupShow(lookupBulk, messages);
                const results: unknown[] = [];
                if (result) {
                    const { showUuid, episodeId } = result;
                    const show = await storage.get(computeShowKey(showUuid));
                    if (!isShowRecord(show)) throw new Error(`Bad show record`);
                    results.push({ ...show, episodeId })
                }
                return { results, message: messages.join(', ') };
            }
            const map = await storage.list(computeListOpts(computeShowKeyPrefix(), parameters));
            const results = [...map.values()].filter(isShowRecord);
            return { results };
        }
        if (operationKind === 'update' && targetPath === '/show/shows' && allowStorageImport) {
            const { json } = parameters;
            const record = tryParseJson(typeof json === 'string' ? json : '');
            if (!isShowRecord(record)) throw new Error(`Invalid input json (expected show record): ${JSON.stringify(json)}`);
            const { uuid } = record;
            await storage.put(computeShowKey(uuid), record);
            return { results: [ record ] };
        }

        if (operationKind === 'select' && targetPath === '/show/show-uuids') {
            const { podcastGuid, rawIpAddress } = parameters;
            if (podcastGuid) {
                const state = this.podcastGuidCallState;
                if (typeof rawIpAddress === 'string' && state[rawIpAddress] && state[rawIpAddress].blocked) return { message: 'blocked' };
                const result = await storage.get(computePodcastGuidToShowUuidIndexKey({ podcastGuid }));
                const results = typeof result === 'string' && isValidUuid(result) ? [ result ] : [];
                if (typeof rawIpAddress === 'string') incrementPodcastGuidLookup({ rawIpAddress, podcastGuid, found: results.length > 0, state });
                return { results };
            }
        }

        if (targetPath === '/show/podcast-guid-call-state') {
            const state = this.podcastGuidCallState;
            if (operationKind === 'select') {
                return { results: [ state ] };
            }
            if (operationKind === 'update') {
                const { block, unblock } = parameters;
                if (typeof block === 'string' && state[block]) state[block].blocked = true;
                if (typeof unblock === 'string' && state[unblock]) state[unblock].blocked = undefined;
                return { results: [ state ] };
            }
        }

        if (operationKind === 'select' && targetPath === '/show/work') {
            const map = await storage.list(computeListOpts('sc.work0.', parameters));
            const results = [...map.values()].filter(isWorkRecord);
            return { results };
        }

        {
            const m = /^\/show\/index\/(podcast-guid|match-url|queryless-match-url|feed-to-show|show-episodes|feed-media-urls|show-episodes-by-pubdate|podcast-guid-to-show-uuid)$/.exec(targetPath);
            if (m && (operationKind === 'select' || operationKind === 'update' || operationKind === 'delete')) {
                const indexType = {
                    'podcast-guid': IndexType.PodcastGuid,
                    'match-url': IndexType.MatchUrlToFeedItem,
                    'queryless-match-url': IndexType.QuerylessMatchUrlToFeedItem,
                    'feed-to-show': IndexType.FeedRecordIdToShowUuid,
                    'show-episodes': IndexType.ShowEpisodes,
                    'feed-media-urls': IndexType.FeedMediaUrls,
                    'show-episodes-by-pubdate': IndexType.ShowEpisodesByPubdate,
                    'podcast-guid-to-show-uuid': IndexType.PodcastGuidToShowUuid,
                }[m[1]];
                if (operationKind === 'select') {
                    const map = await storage.list(computeListOpts(`sc.i0.${indexType}.`, parameters));
                    const expectStringValues = indexType === IndexType.FeedRecordIdToShowUuid || indexType === IndexType.PodcastGuidToShowUuid;
                    if (expectStringValues) {
                        const results = [...map].filter(v => typeof v[1] === 'string').map(v => ({ _key: v[0], _value: v[1] as string }));
                        return { results };
                    } else {
                        const results = [...map].filter(v => isStringRecord(v[1])).map(v => ({ _key: v[0], ...v[1] as Record<string, unknown> }));
                        return { results };
                    }
                }
                if (operationKind === 'update' && indexType) {
                    if (indexType === IndexType.PodcastGuidToShowUuid) {
                        const result = await rebuildPodcastGuidToShowUuidIndex(storage);
                        return { results: [ result ] };
                    } else if (indexType === IndexType.MatchUrlToFeedItem || indexType === IndexType.QuerylessMatchUrlToFeedItem) {
                        const go = parameters.go === 'true';
                        const result = await rebuildMatchUrlToFeedItemIndex({ indexType, storage, go });
                        return { results: [ result ] };
                    } else {
                        throw new Error(`Unsupported index update: ${IndexType[indexType]}`);
                    }
                }
                if (operationKind === 'delete' && indexType) {
                    if (indexType === IndexType.MatchUrlToFeedItem) {
                        const { key } = parameters;
                        if (typeof key !== 'string' || !/^sc\.i0\.2\./.test(key)) throw new Error(`Unexpected key: ${key}`);
                        const deleted = await storage.delete(key);
                        return { results: [ { key, deleted }] };
                    }
                    throw new Error(`Unsupported index delete: ${IndexType[indexType]}`);
                }
            }
        }

        {
            const m = /^\/show\/feeds\/(.+?)\/items$/.exec(targetPath);
            if (m && operationKind === 'select') {
                const feedUrlOrRecordId = m[1];
                const feedRecordId = isValidSha256Hex(feedUrlOrRecordId) ? feedUrlOrRecordId : await computeFeedRecordId(cleanUrl(feedUrlOrRecordId));
                const map = await storage.list(computeListOpts(computeFeedItemRecordKeyPrefix(feedRecordId), parameters));
                const results = [...map.values()].filter(isFeedItemRecord);
                return { results };
            }
            if (m && operationKind === 'delete') {
                const feedUrl = m[1];
                const feedRecordId = await computeFeedRecordId(cleanUrl(feedUrl));
                const feedRecord = await storage.get(computeFeedRecordKey(feedRecordId));
                if (!isFeedRecord(feedRecord)) throw new Error(`No feed record for: ${feedUrl}`);
                const { matchUrlPrefix, itemGuids: itemGuidsStr } = parameters;
                const itemGuids = typeof itemGuidsStr === 'string' ? itemGuidsStr.split(',').map(v => v.trim()).filter(v => v !== '') : undefined;
                const { showUuid } = feedRecord;
                if (showUuid) {
                    if (itemGuids?.length === 1 && await storage.get(computeEpisodeKey({ showUuid, id: await computeEpisodeId(itemGuids[0]) }), { noCache: true }) === undefined) {
                        // only allow deleting items for show feeds if there is no associated episode record, and only one item at a time
                    } else {
                        throw new Error(`Not allowed to delete items for feeds assigned to a show`);
                    }
                }
                const go = parameters.go === 'true';
                const results = [ await deleteFeedItems({ feedRecordId, go, matchUrlPrefix, itemGuids, storage }) ];
                return { results };
            }
        }

        {
            const m = /^\/show\/feeds\/(.*?)$/.exec(targetPath);
            if (m && (operationKind === 'select' || operationKind === 'update')) {
                const feedUrlOrRecordId = m[1];
                const feedRecordId = isValidSha256Hex(feedUrlOrRecordId) ? feedUrlOrRecordId : await computeFeedRecordId(cleanUrl(feedUrlOrRecordId));
                const result = await storage.get(computeFeedRecordKey(feedRecordId));
                if (operationKind === 'select') {
                    if (!isFeedRecord(result)) return { results: [] };

                    const { sub } = parameters;
                    if (typeof sub === 'string'){
                        if (sub === 'ok') {
                            const { lastOkFetch } = result;
                            if (lastOkFetch && lastOkFetch.body) {
                                const blobKey = tryParseBlobKey(lastOkFetch.body);
                                if (blobKey) {
                                    const text = await feedBlobs.get(blobKey, 'text');
                                    if (text) {
                                        return { results: [ { text } ] }
                                    }
                                }
                            }
                        } else {
                            return { message: `Unknown sub: ${sub}` };
                        }
                    }
                    return { results: [ result ] };
                } else if (operationKind === 'update') {
                    if (!isFeedRecord(result)) return { message: `Feed record not found` };
                    const { action, disable = '', force = '', 'refetch-media-urls': refetchMediaUrls, filter } = parameters;
                    if (action === 'update-feed' || action === 'update-feed-and-index-items') {
                        const disableConditional = disable.includes('conditional');
                        const disableGzip = disable.includes('gzip');
                        const { message, updated, fetchStatus } = await updateFeed(result, { storage, origin, blobs: feedBlobs, xfetcher, disableConditional, disableGzip });
                        if (action === 'update-feed-and-index-items' && updated && fetchStatus === 200) {
                            const forceResave = force.includes('resave');
                            const indexItemsMessage = await indexItems(updated, { storage, blobs: feedBlobs, forceResave, origin, refetchMediaUrls });
                            return { message: [ message, indexItemsMessage ].join(', ') };
                        } else {
                            return { message };
                        }
                    } else if (action === 'index-items') {
                        const forceResave = force.includes('resave');
                        const message = await indexItems(result, { storage, blobs: feedBlobs, forceResave, origin, refetchMediaUrls });
                        return { message };
                    } else if (action === 'set-show-uuid') {
                        const { 'show-uuid': showUuid = generateUuid() } = parameters;
                        const message = await setShowUuid(result, showUuid, { storage });
                        return { message };
                    } else if (action === 'remove-show-uuid') {
                        const showUuid = await removeShowUuid(result, storage);
                        return { message: `Removed ${showUuid} from ${result.url}` };
                    } else if (action === 'add-item-filter' || action === 'remove-item-filter') {
                        if (!(typeof filter === 'string' && /^[a-z./]+$/.test(filter))) throw new Error(`Unsupported item filter: ${filter}`);
                        const feedRecordKey = computeFeedRecordKey(result.id);
                        let message = 'No change to item filters';
                        const updated = await storage.transaction(async tx => {
                            const existing = await tx.get(feedRecordKey);
                            if (!isFeedRecord(existing)) return undefined; // deleted?
                            const existingFilters = result.itemFilters ?? [];
                            let newFilters: string[] | undefined;
                            if (action === 'add-item-filter' && !existingFilters.includes(filter)) {
                                newFilters = [ ...existingFilters, filter ];
                                message = 'Added item filter';
                            } else if (action === 'remove-item-filter' && existingFilters.includes(filter)) {
                                newFilters = existingFilters.filter(v => v !== filter);
                                message = 'Removed item filter';
                            }
                            if (newFilters === undefined) return undefined;
                            let update = existing;
                            update = { ...existing, itemFilters: newFilters, updated: new Date().toISOString() };
                            await tx.put(feedRecordKey, update);
                            return update;
                        });
                        return { message, results: [ updated ] };
                    } else if (action === 'update-pifeed') {
                        const podcastGuid = result.piFeed?.podcastGuid ?? result.podcastGuid;
                        if (typeof podcastGuid !== 'string') throw new Error(`Need a podcastGuid`);
                        await enqueueWork([{ uuid: generateUuid(), kind: 'lookup-pg', podcastGuid, attempt: 1 }], storage, this.durableObjectName);
                        return { message: `Enqueued work for ${podcastGuid}` };
                    }
                    return { message: 'Unknown update action' };
                }
            }
        }

        {
            const m = /^\/show\/shows\/(.+?)\/listens$/.exec(targetPath);
            if (m) {
                const { statsBlobs } = this;
                const [ _, input ] = m;
                const showUuid = input;
                check('showUuid', showUuid, isValidUuid);
                const key = computeShowListenStatsKey({ showUuid });
                if (operationKind === 'select') {
                    const result = await statsBlobs.get(key, 'json');
                    const results = isValidShowListenStats(result) ? [ result ] : [];
                    return { results };
                }
                if (operationKind === 'update') {
                    const { payload } = parameters;
                    if (typeof payload !== 'string' || !isValidShowListenStats(JSON.parse(payload))) throw new Error(`Missing or invalid 'payload' parameter`);
                    const { etag } = await statsBlobs.put(key, payload);
                    return { results: [ { etag } ] };
                }
                if (operationKind === 'delete') {
                    if (await statsBlobs.has(key)) {
                        await statsBlobs.delete(key);
                        return { message: 'deleted' };
                    } else {
                        return { message: 'does not exist' };
                    }
                }
            }
        }

        {
            const m = /^\/show\/shows\/(.+?)(\/episodes)?$/.exec(targetPath);
            if (m) {
                const [ _, input, episodes ] = m;
                const showUuid = input;
                check('showUuid', showUuid, isValidUuid);
                if (episodes) {
                    if (operationKind === 'select') {
                        const map = await storage.list({ prefix: computeEpisodeKeyPrefix({ showUuid })});
                        const results = [...map.values()].filter(isEpisodeRecord);
                        return { results };
                    } else if (operationKind === 'delete') {
                        const { episodeId } = parameters;
                        if (typeof episodeId !== 'string' || episodeId.length === 0) throw new Error(`Provide 'episodeId'`);
                        const episodeKey = computeEpisodeKey({ showUuid, id: episodeId });
                        const episode = await storage.get(episodeKey);
                        if (!isEpisodeRecord(episode)) throw new Error(`Episode '${episodeId}' for show '${showUuid}' not found`);
                        const { pubdateInstant } = episode;
                        const keysToDelete = [ episodeKey ];
                        keysToDelete.push(computeShowEpisodesIndexKey(showUuid, episodeId));
                        if (pubdateInstant) keysToDelete.push(computeShowEpisodesByPubdateIndexKey({ pubdateInstant, showUuid, episodeId }));
                        const deleted = await storage.delete(keysToDelete);
                        return { results: [ { showUuid, episodeId, deleted, episode } ] };
                    } else if (operationKind === 'update' && allowStorageImport) {
                        const records = Object.entries(parameters).filter(v => /^episode\d+$/.test(v[0])).map(v => v[1]).map(v => {
                            const record = tryParseJson(typeof v === 'string' ? v : '');
                            if (!isEpisodeRecord(record) || record.showUuid !== showUuid) throw new Error(JSON.stringify(record));
                            return record;
                        });
                        for (const batch of chunk(records, 128)) {
                            const entries = Object.fromEntries(batch.map(v => [ computeEpisodeKey(v), v ]));
                            await storage.put(entries);
                        }
                        return { results: [ { put: records.length } ] };
                    }
                } else {
                    if (operationKind === 'select') {
                        const result = await storage.get(computeShowKey(showUuid));
                        const results = isShowRecord(result) ? [ result ] : [];
                        return { results }
                    }
                    if (operationKind === 'delete') {
                        const result = await deleteShow(showUuid, storage);
                        return { results: [ result ] };
                    }
                }
            }
        }

        if (targetPath === '/show/stats' && operationKind === 'update') {
            const { rpcClient, statsBlobs } = this;
            return await updateShowStats({ parameters, rpcClient, statsBlobs, storage, hitsBlobs });
        }

        if (targetPath === '/show/storage/lookup-show-bulk' && operationKind === 'select') {
            const prefixes = [
                computeMatchUrlToFeedItemIndexKeyPrefix(),
                computeQuerylessMatchUrlToFeedItemIndexKeyPrefix(),
                computeFeedRecordIdToShowUuidIndexKeyPrefix(),
            ];
            const results: [string, DurableObjectStorageValue][] = [];
            for (const prefix of prefixes) {
                const map = await storage.list({ prefix });
                results.push(...[...map]);
            }
            return { results };
        }

        if (targetPath === '/show/showgroups' && operationKind === 'select') {
            const map = await storage.list(computeListOpts(computeShowgroupKeyPrefix(), parameters));
            const results = [...map.values()].filter(isShowgroupRecord);
            return { results };
        }

        if (targetPath === '/show/partitions') {
            const key = computeShowPartitionsKey();
            const record = await loadShowPartitions(storage);
            if (operationKind === 'select') {
                return { results: [ record ] };
            } else if (operationKind === 'update') {
                const { show, partition } = parameters;
                check('show', show, isValidUuid);
                check('partition', partition, isValidPartition);
                const existing = record.partitions[show];
                let updated = false;
                if (existing !== partition) {
                    record.partitions[show] = partition;
                    updated = true;
                    await storage.put(key, record);
                }
                const { partitions } = record;
                return { results: [ { updated, partitions } ] }
            } else if (operationKind === 'delete') {
                const { show } = parameters;
                check('show', show, isValidUuid);
                const existing = record.partitions[show];
                let deleted = false;
                if (existing) {
                    delete record.partitions[show];
                    deleted = true;
                    await storage.put(key, record);
                }
                const { partitions } = record;
                return { results: [ { deleted, partitions } ] }
            }
        }

        {
            const m = /^\/show\/showgroups\/(.*?)$/.exec(targetPath);
            if (m) {
                const showgroupId = m[1];
                if (!isValidShowgroupId(showgroupId)) throw new Error(`Bad showgroupId: ${showgroupId}`);
                const key = computeShowgroupKey(showgroupId);
                if (operationKind === 'select') {
                    const result = await storage.get(key);
                    if (!isShowgroupRecord(result)) return { results: [] };
                    return { results: [ result ]};
                } else if (operationKind === 'delete') {
                    const existed = await storage.delete(key);
                    return { results: [ { existed } ]};
                } else if (operationKind === 'update') {
                    const { showUuid, weight: weightStr } = parameters;
                    if (!isValidUuid(showUuid)) throw new Error(`Bad showUuid: ${showUuid}`);
                    const result = await storage.get(key);
                    const record: ShowgroupRecord = isShowgroupRecord(result) ? result : { id: showgroupId, showUuidWeights: {} };
                    if (weightStr) {
                        const weight = tryParseInt(weightStr);
                        if (typeof weight !== 'number') throw new Error(`Bad weight: ${weightStr}`);
                        record.showUuidWeights[showUuid] = weight;
                    } else {
                        delete record.showUuidWeights[showUuid];
                    }
                    if (!isShowgroupRecord(record)) throw new Error(`Bad update: ${JSON.stringify(record)}`);
                    await storage.put(key, record);
                    return { results: [ record ] };
                }
            }
        }
        
        if (targetPath === '/show/fetch' && operationKind === 'select') {
            const { url, ...rest } = parameters;
            check('url', url, isValidHttpUrl);
            const headers = new Headers(Object.entries(rest).filter(v => v[0].startsWith('x-')).map(v => [ v[0].substring(2), v[1] ]));
            const blobs: Record<string, string> = {};
            const fetchInfo = await computeFetchInfo(url, headers, 'tmp', { put: (key: string, body: ReadableStream<Uint8Array> | ArrayBuffer | string) => {
                blobs[key] = new Bytes(new Uint8Array(body as ArrayBuffer)).utf8();
                return Promise.resolve({ etag: '' });
            } }, tryMakeXfetcher(xfetcher));
            return { results: [ { url, headers: [...headers].map(v => v.join(': ')), fetchInfo, blobs } ] };
        }

        if (targetPath === '/show/storage/backup') {
            const { storage } = this;
            const computeRecordLine = (key: string, record: DurableObjectStorageValue) => {
                return JSON.stringify([ key, record ]);
            }
            const computeKeyRange = (_item: string) => {
                return { startKeyInclusive: undefined, endKeyExclusive: undefined };
            }
            const isValidItem = (item: string) => /^storage$/.test(item);
            const prefix = 'show-storage/1/';
            return await this.backups.execute({ operationKind, parameters, backupBlobs, isValidItem, prefix, computeKeyRange, storage, computeRecordLine });
        }

        throw new Error(`Unsupported show-related query: ${JSON.stringify(req)}`);
    }

    async work(): Promise<void> {
        const { storage, podcastIndexClient, durableObjectName } = this;
        const infos: string[] = [];
        try {
            const limit = 20;
            const map = await storage.list({ prefix: 'sc.work0.', end: `sc.work0.${computeTimestamp()}`, limit });
            console.log(`ShowController: work found ${map.size} records with limit ${limit}`); infos.push(`work found ${map.size} records with limit ${limit}`);
            for (const [ key, record ] of map) {
                if (isWorkRecord(record)) {
                    const r = record;
                    infos.push(r.kind);
                    if (r.kind === 'lookup-pg') {
                        await lookupPodcastGuid(r.podcastGuid, storage, podcastIndexClient);
                    } else if (r.kind === 'lookup-feed') {
                        await lookupFeed(r.feedUrl, storage, podcastIndexClient);
                    } else {
                        consoleWarn('sc-work', `Unsupported work kind: ${JSON.stringify(record)}`);
                    }
                } else {
                    infos.push('invalid');
                    consoleWarn('sc-work', `Invalid work record: ${JSON.stringify(record)}`);
                }
                await this.storage.delete(key);
            }
            if (map.size === limit) {
                // might be more work, peek next item
                const map = await storage.list({ prefix: 'sc.work0.', limit: 1 });
                if (map.size === 1) {
                    const record = [...map.values()][0];
                    if (isWorkRecord(record)) {
                        let { notBeforeInstant = WORK_EPOCH_INSTANT } = record;
                        const minAllowedInstant = new Date(Date.now() + 1000 * 30).toISOString(); // for now only allow a retrigger every 30 seconds in case we infinite loop
                        if (notBeforeInstant < minAllowedInstant) notBeforeInstant = minAllowedInstant;
                        console.log(`ShowController: more work, rescheduling alarm for ${notBeforeInstant}`); infos.push(`more work, rescheduling alarm for ${notBeforeInstant}`);
                        await rescheduleAlarm(notBeforeInstant, storage, durableObjectName);
                    }
                }
            }
        } finally {
            consoleInfo('sc-work', `ShowController: ${infos.join('; ')}`); // for now, keep an eye on every call
        }
    }
}

export async function updateShowStats({ parameters, rpcClient, statsBlobs, storage, hitsBlobs }: { parameters: Record<string, string>, rpcClient: RpcClient, statsBlobs: Blobs, storage: DurableObjectStorage, hitsBlobs: Blobs | undefined }): Promise<Unkinded<AdminDataResponse>> {
    const { hour, date, type } = parameters;

    // compute hourly download tsv
    if (typeof hour === 'string') {
        const { maxHits: maxHitsStr = '100', querySize: querySizeStr = '100', maxQueries: maxQueriesStr = '10', target } = parameters;
        const maxHits = parseInt(maxHitsStr);
        const querySize = parseInt(querySizeStr);
        const maxQueries = parseInt(maxQueriesStr);
        const result = await computeHourlyDownloads(hour, { statsBlobs, maxHits, maxQueries, querySize, rpcClient, target, hitsBlobs });
        return { results: [ result ] };
    }

    // compute hourly show columns
    if (typeof date === 'string' && type === 'show-columns') {
        const { skip = '', hashAlg, startHour: startHourStr, endHour: endHourStr, partition } = parameters;
        const startHour = typeof startHourStr === 'string' ? parseInt(startHourStr) : undefined;
        const endHour = typeof endHourStr === 'string' ? parseInt(endHourStr) : undefined;
        const skipWrite = skip.includes('write');
        const skipLookup = skip.includes('lookup');
        const skipDownloads = skip.includes('downloads');
        const skipBulk = skip.includes('bulk');
        const { lookupShow, preloadMillis, matchUrls, querylessMatchUrls, feedRecordIdsToShowUuids } = skipBulk ? { lookupShow: () => Promise.resolve(undefined), feedRecordIdsToShowUuids: undefined, preloadMillis: undefined, matchUrls: undefined, querylessMatchUrls: undefined} : await lookupShowBulk(storage);
        consoleInfo('sc-show-columns', `lookupShowBulk: ${JSON.stringify({ preloadMillis, matchUrls, querylessMatchUrls, feedRecordIdsToShowUuids })}`);
        const { partitions } = await loadShowPartitions(storage);
        const result = await computeHourlyShowColumns({ date, startHour, endHour, partition, partitions, skipWrite, skipLookup, skipDownloads, hashAlg, statsBlobs, lookupShow });
        return { results: [ { ...result, preloadMillis, matchUrls, querylessMatchUrls, feedRecordIdsToShowUuids } ] };
    }

    // compute daily download tsv
    if (typeof date === 'string') {
        const req = parseComputeShowDailyDownloadsRequest(date, parameters);
        const { partitions } = await loadShowPartitions(storage);
        const result = await computeDailyDownloads(req, { statsBlobs, partitions } );
        return { results: [ result ] };
    }
    
    throw new Error(`Unsupported show stats request: ${JSON.stringify(parameters)}`);
}

export async function lookupShowBulk(storage: DurableObjectStorage) {
    const start = Date.now();
    // preload match urls in memory for fast bulk lookup
    const loadMatchUrls = async (prefix: string) => {
        const map = await storage.list({ prefix });
        const rt = new Map<string, { feedRecordId: string, feedItemRecordId: string }[]>(); // key: matchUrl1024
        for (const [ key, value ] of map) {
            if (!isFeedItemIndexRecord(value)) continue;
            const { matchUrl1024, feedRecordId, feedItemRecordId } = unpackMatchUrlToFeedItemIndexKey(key); // assume same structure for queryless
            const values = rt.get(matchUrl1024) ?? [];
            values.push({ feedRecordId, feedItemRecordId });
            rt.set(matchUrl1024, values);
        }
        return rt;
    };
    // preload showgroups in memory for fast lookup
    const loadShowgroupWeightsByShowUuid = async () => {
        const map = await storage.list({ prefix: computeShowgroupKeyPrefix() });
        const showgroups = [...map.values()].filter(isShowgroupRecord);
        const rt = new Map<string, { showgroupId: string, weight: number }>();
        for (const showgroup of showgroups) {
            const showgroupId = showgroup.id;
            for (const [ showUuid, weight ] of Object.entries(showgroup.showUuidWeights)) {
                rt.set(showUuid, { showgroupId, weight });
            }
        }
        return rt;
    };
    const matchUrls = await loadMatchUrls(computeMatchUrlToFeedItemIndexKeyPrefix());
    const querylessMatchUrls = await loadMatchUrls(computeQuerylessMatchUrlToFeedItemIndexKeyPrefix());
    const feedRecordIdsToShowUuids = await loadFeedRecordIdsToShowUuids(storage);
    const showgroupWeightsByShowUuid = await loadShowgroupWeightsByShowUuid();
    const preloadMillis = Date.now() - start;
    const unableToComputeMatchUrls = new Set<string>();

    const lookupShow = async (url: string, messages?: string[]) => {
        await Promise.resolve();
        messages?.push(`url: ${url}`);
        const destinationUrl = computeChainDestinationUrl(url);
        messages?.push(`destinationUrl: ${destinationUrl}`);
        if (!destinationUrl) return undefined;
        for (const queryless of [ false, true ]) {
            const matchUrl = tryComputeMatchUrl(destinationUrl, { queryless });
            if (matchUrl === undefined) {
                if (!unableToComputeMatchUrls.has(url)) {
                    consoleWarn('lookup-show-bulk', `lookupShowBulk: unable to compute match url for url: ${url}, destinationUrl: ${destinationUrl}`);
                    unableToComputeMatchUrls.add(url);
                }
                return undefined;
            }
            const matchUrl1024 = matchUrl.substring(0, 1024);
            messages?.push(`queryless(${queryless}): matchUrl1024: ${matchUrl1024}`);
            let matches = (queryless ? querylessMatchUrls : matchUrls).get(matchUrl1024);
            if ((!matches || matches.length === 0) && queryless) {
                // in the second pass, handle the case where the url has qp but the enclosure url doesn't
                matches = matchUrls.get(matchUrl1024);
            }
            if (!matches || matches.length === 0) {
                messages?.push(`queryless(${queryless}): no matches`);
                continue;
            }
            const showMatches = matches.flatMap(({ feedRecordId, feedItemRecordId }) => {
                const showUuid = feedRecordIdsToShowUuids.get(feedRecordId);
                return showUuid ? [ { feedRecordId, feedItemRecordId, showUuid } ] : [];
            });
            if (showMatches.length === 1) {
                messages?.push(`queryless(${queryless}): single match: ${JSON.stringify(showMatches[0])}`);
                const { showUuid, feedItemRecordId: episodeId } = showMatches[0];
                return { showUuid, episodeId }
            }
            const showUuids = distinct(showMatches.map(v => v.showUuid)).filter(isString);
            messages?.push(`queryless(${queryless}): multiple matches: ${JSON.stringify({ showMatches, showUuids })}`);
            if (showUuids.length === 1) {
                const showUuid = showUuids[0];
                const feedItemRecordIds = distinct(showMatches.map(v => v.feedItemRecordId));
                const episodeId = feedItemRecordIds.length === 1 ? feedItemRecordIds[0] : undefined;
                return { showUuid, episodeId };
            }
            if (showUuids.length > 1) {
                const showUuidsWithShowgroupInfo = showUuids.map(showUuid => ({ showUuid, ...(showgroupWeightsByShowUuid.get(showUuid) ?? { showgroupId: '', weight: 0 }) }));
                if (showUuidsWithShowgroupInfo.every(v => v.showgroupId !== '') && distinct(showUuidsWithShowgroupInfo.map(v => v.showgroupId)).length === 1) {
                    // url exists in multiple show feeds, but they are all part of the same showgroup - choose the max weighted show as the winner (show-uuid breaks ties)
                    const maxWeight = Math.max(...showUuidsWithShowgroupInfo.map(v => v.weight));
                    const winnerShowUuid = sortBy(showUuidsWithShowgroupInfo.filter(v => v.weight === maxWeight), v => v.showUuid).at(0)?.showUuid;
                    messages?.push(`queryless(${queryless}): single showgroup: ${JSON.stringify({ showUuidsWithShowgroupInfo, maxWeight, winnerShowUuid })}`);
                    if (winnerShowUuid) {
                        const feedItemRecordIds = distinct(showMatches.filter(v => v.showUuid === winnerShowUuid).map(v => v.feedItemRecordId));
                        const episodeId = feedItemRecordIds.length === 1 ? feedItemRecordIds[0] : undefined;
                        return { showUuid: winnerShowUuid, episodeId };
                    }
                }
            }
        }
        return undefined;
    };
    return { lookupShow, preloadMillis, matchUrls: matchUrls.size, querylessMatchUrls: querylessMatchUrls.size, feedRecordIdsToShowUuids: feedRecordIdsToShowUuids.size };
}

export function isValidPodcastGuid(podcastGuid: string): boolean {
    return typeof podcastGuid === 'string' && (isValidGuid(podcastGuid) || /^0x[a-fA-F0-9]{40}$/.test(podcastGuid)); // 0x1bECc6153CBdF5654357E5AAc813D5f1a45c40a6
}

//

const WORK_EPOCH_TIMESTAMP = computeStartOfYearTimestamp(2020);
const WORK_EPOCH_INSTANT = timestampToInstant(WORK_EPOCH_TIMESTAMP);

async function rescheduleAlarm(soonestNotBeforeInstant: string, storage: DurableObjectStorage, durableObjectName: string) {
    const soonestNotBeforeTime = new Date(soonestNotBeforeInstant).getTime();
    await storage.transaction(async tx => {
        const alarm = await tx.getAlarm();
        if (typeof alarm === 'number' && alarm <= soonestNotBeforeTime) return;
        await tx.put('alarm.payload', { kind: ShowController.processAlarmKind } as AlarmPayload);
        await tx.setAlarm(soonestNotBeforeTime);
    });
    writeTraceEvent({ kind: 'storage-write', durableObjectName, spot: 'sc.rescheduleAlarm', alarms: 1 });
}

async function enqueueWork(work: WorkRecord | WorkRecord[], storage: DurableObjectStorage, durableObjectName: string): Promise<void> {
    const works = Array.isArray(work) ? work : [ work ];
    if (works.length === 0) return;
    for (const batch of chunk(works, 128)) {
        const records = Object.fromEntries(batch.map(v => [ computeWorkRecordKey(v), v ]));
        await storage.put(records);
    }
    const soonestNotBeforeInstant = works.map(v => v.notBeforeInstant ?? WORK_EPOCH_INSTANT).sort()[0];
    await rescheduleAlarm(soonestNotBeforeInstant, storage, durableObjectName);
}

function computeWorkRecordKey(record: WorkRecord): string {
    const { notBeforeInstant, uuid } = record;
    const notBeforeTimestamp = typeof notBeforeInstant === 'string' ? computeTimestamp(notBeforeInstant) : WORK_EPOCH_TIMESTAMP;
    return `sc.work0.${notBeforeTimestamp}.${uuid}`;
}

async function getPodcastIndexFeed(type: 'podcastGuid' | 'feedUrl', value: string, client: PodcastIndexClient ): Promise<PodcastIndexFeed | undefined> {
    const { feed } = type === 'podcastGuid' ? await client.getPodcastByGuid(value) : await client.getPodcastByFeedUrl(value);
    if (typeof feed === 'object' && !Array.isArray(feed)) {
        const { id, podcastGuid: podcastGuidRaw } = feed;
        const tag = `${type} ${value}`;
        if (typeof id !== 'number' || id <= 0) throw new Error(`Bad piFeed: ${JSON.stringify(feed)} for ${tag}`);
        const url = tryCleanUrl(feed.url);
        if (typeof url !== 'string') throw new Error(`Bad piFeed: ${JSON.stringify(feed)} for ${tag}`);
        const podcastGuidCleaned = typeof podcastGuidRaw === 'string' ? podcastGuidRaw.trim().toLowerCase() : undefined;
        if (typeof podcastGuidCleaned === 'string' && !isValidGuid(podcastGuidCleaned)) throw new Error(`Bad piFeed: ${JSON.stringify(feed)} for ${tag}`);
        return { id, url, podcastGuid: podcastGuidCleaned };
    }
}

async function lookupPodcastGuid(podcastGuid: string, storage: DurableObjectStorage, client: PodcastIndexClient) {
    let piFeed: PodcastIndexFeed | undefined;
    try {
        piFeed = await getPodcastIndexFeed('podcastGuid', podcastGuid, client);
    } catch (e) {
        consoleWarn('sc-lookup-podcast-guid', `Error calling getPodcastByGuid: ${(e as Error).stack || e}`);
        await storage.put(computePodcastGuidIndexKey(podcastGuid), { podcastGuid, state: 'error' });
        return;
    }
    const feedRecordId = piFeed ? await computeFeedRecordId(piFeed.url) : undefined;
    const piFeedUrl = piFeed?.url;
    await storage.transaction(async tx => {
        const state = piFeed ? 'found' : 'not-found';
        const piCheckedInstant = new Date().toISOString();
        await tx.put(computePodcastGuidIndexKey(podcastGuid), { podcastGuid, state, piCheckedInstant, piFeed });

        if (feedRecordId && piFeedUrl) {
            const existing = await tx.get(computeFeedRecordKey(feedRecordId));
            const time = new Date().toISOString();
            if (existing) {
                if (isFeedRecord(existing)) {
                    const update: FeedRecord = { ...existing, piFeed, piCheckedInstant, updated: time };
                    await tx.put(computeFeedRecordKey(feedRecordId), update);
                } else {
                    consoleWarn(`sc-lookup-podcast-guid`, `Failed update bad FeedRecord: ${JSON.stringify(existing)}`);
                }
            } else {
                const insert: FeedRecord = { id: feedRecordId, url: piFeedUrl, state: 'new', piFeed, piCheckedInstant, created: time, updated: time };
                await tx.put(computeFeedRecordKey(feedRecordId), insert);
                consoleInfo('sc-lookup-podcast-guid', `Inserted new FeedRecord: ${insert.url}`);
            }
        }
    });
    // TODO enqueue update-feed if necessary
}

async function lookupFeed(feedUrl: string, storage: DurableObjectStorage, client: PodcastIndexClient) {
    let piFeed: PodcastIndexFeed | undefined;
    try {
        piFeed = await getPodcastIndexFeed('feedUrl', feedUrl, client);
    } catch (e) {
        consoleWarn('sc-lookup-podcast-feed', `Error calling getPodcastByFeedUrl: ${(e as Error).stack || e}`);
        return;
    }
    if (piFeed === undefined) {
        consoleWarn('sc-lookup-podcast-feed', `Feed url not found: ${feedUrl}`);
        return;
    }

    const feedRecordId = await computeFeedRecordId(feedUrl);

    await storage.transaction(async tx => {
        const existing = await tx.get(computeFeedRecordKey(feedRecordId));
        if (!existing) {
            consoleWarn(`sc-lookup-podcast-feed`, `FeedRecord not found: ${feedUrl}`);
            return;
        }
        if (!isFeedRecord(existing)) {
            consoleWarn(`sc-lookup-podcast-feed`, `Bad FeedRecord found: ${JSON.stringify(existing)}`);
            return;
        }
        const time = new Date().toISOString();
        const update: FeedRecord = { ...existing, piFeed, piCheckedInstant: time, updated: time };
        await tx.put(computeFeedRecordKey(feedRecordId), update);
    });
    // TODO enqueue update-feed if necessary
}

async function updateFeed(feedUrlOrRecord: string | FeedRecord, opts: { storage: DurableObjectStorage, origin: string, blobs: Blobs, xfetcher: string | undefined, disableConditional?: boolean, disableGzip?: boolean }): Promise<{ message: string, updated?: FeedRecord, fetchStatus?: number }> {
    const { storage, origin, blobs, xfetcher, disableConditional = false, disableGzip = false } = opts;
    const feedRecord = await loadFeedRecord(feedUrlOrRecord, storage);
    const { url: feedUrl } = feedRecord;

    const rt = [ feedUrl ];

    // try to make a conditional request, based on last ok response received
    const headers = new Headers({
        'user-agent': computeUserAgent({ origin }),
    });
    if (!disableGzip) {
        rt.push('gzip');
        headers.set('accept-encoding', 'gzip');
    }
    const { lastOkFetch } = feedRecord;
    if (lastOkFetch && !disableConditional) {
        const lastOkFetchHeaders = new Headers(lastOkFetch.headers ?? []);
        const etag = lastOkFetchHeaders.get('etag');
        const lastModified = lastOkFetchHeaders.get('last-modified');
        if (typeof etag === 'string') {
            headers.set('if-none-match', etag);
            rt.push(`if-none-match: ${etag}`);
        } else if (typeof lastModified === 'string') {
            headers.set('if-modified-since', lastModified);
            rt.push(`if-modified-since: ${lastModified}`);
        }
    }
    const fetchUrl = `${feedUrl}${feedUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`; // cache buster query param
    const blobKeyBase = (await Bytes.ofUtf8(fetchUrl).sha256()).hex();
    const fetchInfo = await computeFetchInfo(feedUrl, headers, blobKeyBase, blobs, tryMakeXfetcher(xfetcher));
    const feedRecordKey = computeFeedRecordKey(feedRecord.id);
    const updated = await storage.transaction(async tx => {
        const existing = await tx.get(feedRecordKey);
        if (!isFeedRecord(existing)) return undefined; // deleted?
        let update = existing;
        if (fetchInfo.status === 200) {
            rt.push('200');
            update = { ...update, lastOkFetch: fetchInfo };
        } else if (fetchInfo.status === 304) { // not modified
            rt.push('304');
            update = { ...update, lastNotModifiedInstant: fetchInfo.responseInstant };
        } else {
            if (typeof fetchInfo.status === 'number') rt.push(fetchInfo.status.toString());
            if (fetchInfo.error !== undefined) rt.push(JSON.stringify(fetchInfo.error));
            update = { ...update, lastErrorFetch: fetchInfo };
        }
        update = { ...update, updated: new Date().toISOString() };
        await tx.put(feedRecordKey, update);
        return update;
    });
    const contentType = getHeader(fetchInfo.headers, 'content-type');
    if (contentType) rt.push(contentType);
    if (fetchInfo.bodyLength) rt.push(Bytes.formatSize(fetchInfo.bodyLength));
    const message = rt.join(', ');
    return { message, updated, fetchStatus: fetchInfo.status };
}

async function loadFeedRecord(feedUrlOrRecord: string | FeedRecord, storage: DurableObjectStorage): Promise<FeedRecord> {
    const feedRecord = typeof feedUrlOrRecord === 'string' ? await storage.get(computeFeedRecordKey(await computeFeedRecordId(feedUrlOrRecord))) : feedUrlOrRecord;
    if (feedRecord === undefined) throw new Error(`FeedRecord not found: ${feedUrlOrRecord}`);
    if (!isFeedRecord(feedRecord)) throw new Error(`Bad FeedRecord found: ${JSON.stringify(feedRecord)}`);
    return feedRecord;
}

async function loadFeedRecords(storage: DurableObjectStorage): Promise<FeedRecord[]> {
    const map = await storage.list({ prefix: 'sc.fr0.' });
    return [...map.values()].filter(isFeedRecord);
}

async function findShowRecord(showUuid: string, storage: DurableObjectStorage): Promise<ShowRecord | undefined> {
    const record = await storage.get(computeShowKey(showUuid));
    if (record !== undefined && !isShowRecord(record)) throw new Error(`Bad ShowRecord found for ${showUuid}: ${JSON.stringify(record)}`);
    return record;
}

async function indexItems(feedUrlOrRecord: string | FeedRecord, opts: { storage: DurableObjectStorage, blobs: Blobs, forceResave?: boolean, origin: string, refetchMediaUrls: string | undefined }): Promise<string> {
    const { storage, blobs, forceResave = false, origin, refetchMediaUrls } = opts;
    let feedRecord = await loadFeedRecord(feedUrlOrRecord, storage);
    const { url: feedUrl, showUuid } = feedRecord;

    const rt = [ feedUrl ];

    const { lastOkFetch } = feedRecord;
    if (!lastOkFetch) return [ ...rt, 'no ok response' ].join(', ');

    const { body } = lastOkFetch;
    if (!body) return [ ...rt, 'no ok response body' ].join(', ');

    const blobKey = tryParseBlobKey(body);
    if (!blobKey) return [ ...rt, `unknown ok response body: ${body}` ].join(', ');

    const text = await blobs.get(blobKey, 'text'); // assumes utf-8
    if (!text) return [ ...rt, `ok response body text not found: ${body}` ].join(', ');

    const feed = parseFeed(text);
    console.log(JSON.stringify(feed, undefined, 2));

    rt.push(`${feed.items.length} items, ${feed.items.flatMap(v => v.enclosures ?? []).length} enclosures, ${feed.items.flatMap(v => v.alternateEnclosures ?? []).length} alternate enclosures`);

    const feedRecordId = feedRecord.id;

    // update feed-level attributes if necessary
    if (feedRecord.title !== feed.title
            || feedRecord.podcastGuid !== feed.podcastGuid
            || feedRecord.generator !== feed.generator
            || feedRecord.link !== feed.link
            || feedRecord.itunesAuthor !== feed.itunesAuthor
            || feedRecord.itunesType !== feed.itunesType
            || !equalItunesCategories(feedRecord.itunesCategories, feed.itunesCategories)
            || feedRecord.medium !== feed.medium
        ) {
        const update: FeedRecord = { ...feedRecord,
            title: feed.title,
            podcastGuid: feed.podcastGuid,
            generator: feed.generator,
            link: feed.link,
            itunesAuthor: feed.itunesAuthor,
            itunesType: feed.itunesType,
            itunesCategories: feed.itunesCategories,
            medium: feed.medium,
            updated: new Date().toISOString(),
        };
        await storage.put(computeFeedRecordKey(feedRecordId), update);
        if (feedRecord.title !== feed.title) rt.push(`updated title from ${feedRecord.title} -> ${feed.title}`);
        if (feedRecord.podcastGuid !== feed.podcastGuid) rt.push(`updated podcastGuid from ${feedRecord.podcastGuid} -> ${feed.podcastGuid}`);
        if (feedRecord.generator !== feed.generator) rt.push(`updated generator from ${feedRecord.generator} -> ${feed.generator}`);
        if (feedRecord.link !== feed.link) rt.push(`updated link from ${feedRecord.link} -> ${feed.link}`);
        if (feedRecord.itunesAuthor !== feed.itunesAuthor) rt.push(`updated itunesAuthor from ${feedRecord.itunesAuthor} -> ${feed.itunesAuthor}`);
        if (feedRecord.itunesType !== feed.itunesType) rt.push(`updated itunesType from ${feedRecord.itunesType} -> ${feed.itunesType}`);
        if (!equalItunesCategories(feedRecord.itunesCategories, feed.itunesCategories)) rt.push(`updated itunesCategories from ${stringifyItunesCategories(feedRecord.itunesCategories)} -> ${stringifyItunesCategories(feed.itunesCategories)}`);
        if (feedRecord.medium !== feed.medium) rt.push(`updated medium from ${feedRecord.medium} -> ${feed.medium}`);
        feedRecord = update;
    }

    // collect items by trimmed item guid
    const itemsByTrimmedGuid = Object.fromEntries(feed.items.map(v => [ (v.guid ?? '').trim().substring(0, 8 * 1024), v ]));
    delete itemsByTrimmedGuid['']; // only save items with non-empty guids
    rt.push(`${Object.keys(itemsByTrimmedGuid).length} unique non-empty item guids`);

    // manually fetch redirect urls if necessary
    const computeEnclosureUrls = (item: Item): string[] => [ ...(item.enclosures ?? []).map(v => v.url).filter(isString), ...(item.alternateEnclosures ?? []).flatMap(v => v.sources ?? []).map(v => v.uri).filter(isString) ];
    const loadMediaUrls = Object.values(itemsByTrimmedGuid).flatMap(computeEnclosureUrls).some(v => isRedirectFetchingRequired({ generator: undefined, enclosureUrl: v }));
    const knownMediaUrls = loadMediaUrls || isRedirectFetchingRequired({ generator: feed.generator, enclosureUrl: undefined }) ? await loadKnownMediaUrls({ feedRecordId, storage }) : undefined;
    let knownRedirectUrls: Record<string, string[]> | undefined;
    if (knownMediaUrls) {
        const loaded = Object.keys(knownMediaUrls).length;
        if (loaded > 0) rt.push(`Loaded ${loaded} media urls`);
        const userAgent = computeUserAgent({ origin });
        const { fetched, remaining, carriedOver } = await fetchMediaUrlsIfNecessary({ knownMediaUrls, items: Object.values(itemsByTrimmedGuid), storage, feedRecordId, userAgent, refetch: refetchMediaUrls });
        if (fetched > 0) rt.push(`Fetched ${fetched} media urls`);
        if (carriedOver > 0) rt.push(`${carriedOver} carried over`);
        if (remaining > 0) rt.push(`${remaining} media urls remaining`);
        knownRedirectUrls = Object.fromEntries(Object.entries(knownMediaUrls).map(v => [ v[0], v[1].redirectUrls ?? [] ]));
    }

    // compute and save new/updated feed item records and matchurl index records
    const newRecords: Record<string, FeedItemRecord> = {};
    const newIndexRecords: Record<string, FeedItemIndexRecord> = {};
    if (forceResave) rt.push('forceResave');
    let updates = 0;
    let inserts = 0;
    for (const batch of chunk(Object.entries(itemsByTrimmedGuid), 128)) {
        const feedItemRecordIds = await Promise.all(batch.map(v => computeFeedItemRecordId(v[1].guid!)));
        const feedItemRecordKeys = feedItemRecordIds.map(v => computeFeedItemRecordKey(feedRecord.id, v));
        const map = await storage.get(feedItemRecordKeys);
        for (let i = 0; i < batch.length; i++) {
            const feedItemRecordId = feedItemRecordIds[i];
            const feedItemRecordKey = feedItemRecordKeys[i];
            const trimmedGuid = batch[i][0];
            const item = batch[i][1];
            let existing = map.get(feedItemRecordKey);
            if (existing !== undefined && !isFeedItemRecord(existing)) {
                consoleWarn('sc-index-items', `Overwriting bad FeedItemRecord(${feedItemRecordKey}): ${JSON.stringify(existing)}`);
                existing = undefined;
            }
            let record = existing;
            const instant = lastOkFetch.responseInstant;
            const isInsert = !record;
            if (!record) {
                record = { feedRecordId, id: feedItemRecordId, guid: trimmedGuid, firstSeenInstant: instant, lastSeenInstant: instant, relevantUrls: {} };
            }
            if (record.lastOkFetch === undefined || instant > record.lastSeenInstant || forceResave) {
                const relevantUrls = computeRelevantUrls(item, knownRedirectUrls);
                for (const relevantUrl of Object.values(relevantUrls)) {
                    const destinationUrl = computeChainDestinationUrl(relevantUrl);
                    if (destinationUrl) {
                        const incomingDestinationUrl = tryComputeIncomingUrl(destinationUrl) ?? destinationUrl;
                        const matchUrl = tryComputeMatchUrl(incomingDestinationUrl);
                        if (matchUrl) {
                            newIndexRecords[computeMatchUrlToFeedItemIndexKey(matchUrl, feedRecordId, feedItemRecordId)] = { feedItemRecordKey };
                            if (matchUrl.includes('?')) {
                                const querylessMatchUrl = tryComputeMatchUrl(incomingDestinationUrl, { queryless: true });
                                if (querylessMatchUrl) {
                                    newIndexRecords[computeQuerylessMatchUrlToFeedItemIndexKey(querylessMatchUrl, feedRecordId, feedItemRecordId)] = { feedItemRecordKey };
                                }
                            }
                        }
                    }
                }
                const { title, pubdate, pubdateInstant, transcripts } = item;
                const hasTranscripts = transcripts && transcripts.length > 0;
                const update: FeedItemRecord = { ...record, lastOkFetch, lastSeenInstant: instant, relevantUrls, title, pubdate, pubdateInstant, hasTranscripts };
                newRecords[feedItemRecordKey] = update;
                if (isInsert) {
                    inserts++;
                } else {
                    updates++;
                }
            }
        }
    }

    if (inserts > 0) rt.push(`${inserts} FeedItemRecord inserts`);
    if (updates > 0) rt.push(`${updates} FeedItemRecord updates`);
    if (Object.keys(newRecords).length > 0) {
        for (const batch of chunk(Object.entries(newRecords), 128)) {
            await storage.put(Object.fromEntries(batch));
        }
    }
    if (Object.keys(newIndexRecords).length > 0) {
        rt.push(`${Object.keys(newIndexRecords).length} index updates`);
        for (const batch of chunk(Object.entries(newIndexRecords), 128)) {
            await storage.put(Object.fromEntries(batch));
        }
    }

    if (showUuid !== undefined) {
        // update show attributes if necessary
        const show = await setShowAttributesFromFeed(feedRecord, storage, rt);

        const podcastGuid = show?.podcastGuid;
        const { itemFilters } = feedRecord;
        await ensureShowEpisodesExistForAllFeedItems({ feedRecordId, showUuid, podcastGuid, itemFilters, storage, rt });
    }

    return rt.join(', ');
}

async function deleteFeedItems({ feedRecordId, go, matchUrlPrefix, itemGuids, storage }: { feedRecordId: string, go: boolean, matchUrlPrefix: string | undefined, itemGuids: string[] | undefined, storage: DurableObjectStorage }) {
    const feedItemRecords = [...(await storage.list({ prefix: computeFeedItemRecordKeyPrefix(feedRecordId) })).values()]
        .filter(isFeedItemRecord)
        .filter(v => !itemGuids || itemGuids.includes(v.guid))
        ;
    const feedItemRecordIds = new Set(feedItemRecords.map(v => v.id));

    // first, delete any match url index records (found by provided prefix) pointing to these items
    const indexRecordKeysToDelete: string[] = [];
    let indexRecordsDeleted = 0;
    if (matchUrlPrefix) {
        for (const prefix of [ computeMatchUrlToFeedItemIndexKeyPrefix(), computeQuerylessMatchUrlToFeedItemIndexKeyPrefix() ]) {
            const matchUrlsMap = await storage.list({ prefix: prefix + matchUrlPrefix });
            for (const [ key, feedItemIndexRecord ] of matchUrlsMap) {
                if (!isFeedItemIndexRecord(feedItemIndexRecord)) throw new Error(`Bad index record ${key}`);
                const { feedItemRecordId, feedRecordId: feedRecordIdFromIndex } = unpackMatchUrlToFeedItemIndexKey(key);
                if (feedItemRecordIds.has(feedItemRecordId) && feedRecordIdFromIndex === feedRecordId) {
                    indexRecordKeysToDelete.push(key);
                }
            }
        }
    }

    // now, delete the items themselves
    const feedItemRecordKeysToDelete = [...feedItemRecordIds].map(v => computeFeedItemRecordKey(feedRecordId, v));
    let feedItemRecordsDeleted = 0;
    if (go) {
        for (const batch of chunk(indexRecordKeysToDelete, 128)) {
            indexRecordsDeleted += await storage.delete(batch);
        }
        for (const batch of chunk(feedItemRecordKeysToDelete, 128)) {
            feedItemRecordsDeleted += await storage.delete(batch);
        }
    }

    return { indexRecordKeysToDelete: indexRecordKeysToDelete.length, indexRecordsDeleted, feedItemRecordKeysToDelete: feedItemRecordKeysToDelete.length, feedItemRecordsDeleted, go };
}

async function ensureShowEpisodesExistForAllFeedItems({ feedRecordId, showUuid, podcastGuid, itemFilters, storage, rt }: { feedRecordId: string, showUuid: string, podcastGuid: string | undefined, itemFilters: string[] | undefined, storage: DurableObjectStorage, rt: string[] }) {
    const { inserts, updates, index1Writes, index2Writes, ignored } = await ensureEpisodesExistForAllFeedItems({ feedRecordId, showUuid, podcastGuid, itemFilters, storage });
    if (inserts > 0) rt.push(`${inserts} ep inserts`);
    if (updates > 0) rt.push(`${updates} ep updates`);
    if (index1Writes > 0) rt.push(`${index1Writes} ep index writes`);
    if (index2Writes > 0) rt.push(`${index2Writes} ep-by-pubdate index writes`);
    if (ignored > 0) rt.push(`${ignored} items ignored`);
}

function needsAnotherFetch(record: MediaUrlIndexRecord, refetch: string | undefined): boolean {
    if (refetch && (record.refetch === undefined || refetch > record.refetch)) return true;
    if (record.redirectUrls && record.redirectUrls.some(hasOp3Reference)) return false;
    const age = Date.now() - new Date(record.updateInstant).getTime();
    return age > 1000 * 60 * 60 * 24;
}

async function computeNewMediaUrlIndexRecord(url: string, userAgent: string, refetch: string | undefined): Promise<MediaUrlIndexRecord> {
    try {
        const { redirectUrls, responseHeaders } = await fetchOp3RedirectUrls(url, { userAgent });
        const responseInstant = new Date().toISOString();
        return { url, updateInstant: responseInstant, responseInstant, redirectUrls, responseHeaders, refetch };
    } catch (e) {
        const error = `${(e as Error).stack || e}`;
        return { url, updateInstant: new Date().toISOString(), error, refetch };
    }
}

async function fetchMediaUrlsIfNecessary({ knownMediaUrls, items, storage, userAgent, feedRecordId, refetch }: { knownMediaUrls: Record<string, MediaUrlIndexRecord>, items: Item[], storage: DurableObjectStorage, userAgent: string, feedRecordId: string, refetch: string | undefined }): Promise<{ fetched: number, remaining: number, carriedOver: number }> {
    const mediaUrls = distinct(items.flatMap(v => [...(v.enclosures ?? []).map(w => w.url).filter(isString), ...(v.alternateEnclosures ?? []).flatMap(w => (w.sources ?? []).map(x => x.uri).filter(isString))]));
    const toFetch: string[] = [];
    for (const mediaUrl of mediaUrls) {
        if (hasOp3Reference(mediaUrl)) continue; // no need to actually fetch if it's in the explicit url
        const known = knownMediaUrls[mediaUrl];
        if (!known || needsAnotherFetch(known, refetch)) {
            toFetch.push(mediaUrl);
        }
    }
    let fetched = 0;
    let remaining = toFetch.length;
    let carriedOver = 0;
    const upserts: Record<string, MediaUrlIndexRecord> = {};
    for (const url of toFetch) {
        let upsert = await computeNewMediaUrlIndexRecord(url, userAgent, refetch);
        if (refetch) {
            const known = knownMediaUrls[url];
            if (known && known.redirectUrls && known.redirectUrls.length > 0) {
                // if refetching, carry over previously-found relevant urls
                upsert = { ...upsert, redirectUrls: [ ...known.redirectUrls, ...(upsert.redirectUrls ?? []) ] };
                carriedOver++;
            }
        }
        upserts[computeFeedMediaUrlsIndexKey({ feedRecordId, url })] = upsert;
        fetched++;
        remaining--;
        if (fetched >= 10) break;
    }
    if (Object.keys(upserts).length > 0) await storage.put(upserts);
    return { fetched, remaining, carriedOver };
}

function computeRelevantUrls(item: Item, knownRedirects?: Record<string, string[]>): Record<string, string> {
    const rt: Record<string, string> = {};
    const addRelevantUrlIfPresent = (path: string, url?: string) => {
        if (url && hasOp3Reference(url)) {
            rt[path] = url;
        } else if (url && knownRedirects) {
            (knownRedirects[url] ?? []).filter(hasOp3Reference).forEach((redirect, i) => {
                rt[`${path}.redirect${i === 0 ? '' : `.${i + 1}`}`] = redirect;
            });
        }
    };
    if (item.enclosures) {
        item.enclosures.forEach((v, i) => {
            addRelevantUrlIfPresent(`e.${i}.url`, v.url);
        });
    }
    if (item.alternateEnclosures) {
        item.alternateEnclosures.forEach((v, i) => {
            if (v.sources) {
                v.sources.forEach((w, j) => {
                    addRelevantUrlIfPresent(`ae.${i}.s.${j}.uri`, w.uri);
                });
            }
        });
    }
    return rt;
}

async function setShowUuid(feedUrlOrRecord: string | FeedRecord, showUuid: string, opts: { storage: DurableObjectStorage }): Promise<string> {
    const { storage } = opts;
    const feedRecord = await loadFeedRecord(feedUrlOrRecord, storage);
    check('showUuid', showUuid, isValidUuid);

    let showRecord = await findShowRecord(showUuid, storage);
    if (showRecord) {
        // fine, assume we already have the title, podcastGuid from original (will do proper podcastGuid indexing later)
    } else {
        let podcastGuid = feedRecord.podcastGuid;
        if (/^[a-z]{4}-0x[0-9a-fA-F]{40}$/.test(podcastGuid ?? '')) {
            // ignore this found invalid guid style
            podcastGuid = undefined;
        }
        if (podcastGuid === undefined) {
            if (feedRecord.piFeed === undefined) throw new Error(`Feed must have a piFeed`);
            podcastGuid = feedRecord.piFeed.podcastGuid;
        }
        if (podcastGuid === undefined || !isValidPodcastGuid(podcastGuid)) throw new Error(`Feed must have a piFeed with a valid podcastGuid`);
        showRecord = { uuid: showUuid, title: feedRecord.title, podcastGuid };
    }

    const rt: string[] = [];
    rt.push(`showGuid: ${showUuid}`);

    // save feed and show record
    const update: FeedRecord = { ...feedRecord, showUuid, updated: new Date().toISOString() };
    await storage.put(Object.fromEntries([
        [ computeFeedRecordKey(update.id), update ],
        [ computeShowKey(showRecord.uuid), showRecord ],
        [ computeFeedRecordIdToShowUuidIndexKey(feedRecord.id), showUuid ],
    ]));

    const { podcastGuid } = showRecord;
    // save initial podcastguid -> showuuid index record
    if (podcastGuid) await storage.put(computePodcastGuidToShowUuidIndexKey({ podcastGuid }), showUuid);

    const { itemFilters } = feedRecord;
    await ensureShowEpisodesExistForAllFeedItems({ feedRecordId: feedRecord.id, showUuid, podcastGuid, itemFilters, storage, rt });

    return rt.join(', ');
}

async function removeShowUuid(feedRecord: FeedRecord, storage: DurableObjectStorage): Promise<string> {
    const { showUuid } = feedRecord;
    if (!showUuid) throw new Error(`No showUuid for this feed record`);
    check('showUuid', showUuid, isValidUuid);

    const update: FeedRecord = { ...feedRecord, showUuid: undefined, updated: new Date().toISOString() };
    await storage.transaction(async tx => {
        await tx.put(computeFeedRecordKey(update.id), update);
        await tx.delete(computeFeedRecordIdToShowUuidIndexKey(feedRecord.id));
    });
    return showUuid;
}

async function setShowAttributesFromFeed(feedRecord: FeedRecord, storage: DurableObjectStorage, messages: string[]): Promise<ShowRecord | undefined> {
    const { showUuid } = feedRecord;
    if (!showUuid) return;
    const showKey = computeShowKey(showUuid);
    const record = await storage.get(showKey);
    if (!isShowRecord(record)) return;
    let show = record;
    const upsertRecords: Record<string, DurableObjectStorageValue> = {};
    let deleteIndexKey: string | undefined;
    const { title, podcastGuid: feedPodcastGuid, link, itunesAuthor, piFeed, medium } = feedRecord;
    const podcastGuid = feedPodcastGuid ?? piFeed?.podcastGuid;
    if (show.title !== title) {
        messages.push(`show.title ${show.title} -> ${title}`);
        show = { ...show, title };
        upsertRecords[showKey] = show;
    }
    if (show.link !== link) {
        messages.push(`show.link ${show.link} -> ${link}`);
        show = { ...show, link };
        upsertRecords[showKey] = show;
    }
    if (show.itunesAuthor !== itunesAuthor) {
        messages.push(`show.itunesAuthor ${show.itunesAuthor} -> ${itunesAuthor}`);
        show = { ...show, itunesAuthor };
        upsertRecords[showKey] = show;
    }
    if (podcastGuid && show.podcastGuid !== podcastGuid) {
        if (show.podcastGuid) {
            deleteIndexKey = computePodcastGuidToShowUuidIndexKey({ podcastGuid: show.podcastGuid });
        }
        messages.push(`show.podcastGuid ${show.podcastGuid} -> ${podcastGuid}`);
        show = { ...show, podcastGuid };
        upsertRecords[showKey] = show;
        upsertRecords[computePodcastGuidToShowUuidIndexKey({ podcastGuid })] = showUuid;
    }
    if (show.medium !== medium) {
        messages.push(`show.medium ${show.medium} -> ${medium}`);
        show = { ...show, medium };
        upsertRecords[showKey] = show;
    }
    if (Object.keys(upsertRecords).length > 0 || deleteIndexKey) {
        await storage.transaction(async tx => {
            if (deleteIndexKey) await tx.delete(deleteIndexKey);
            if (Object.keys(upsertRecords).length > 0) await tx.put(upsertRecords);
        })
    }
    return show;
}

async function ensureEpisodesExistForAllFeedItems(opts: { feedRecordId: string, showUuid: string, podcastGuid: string | undefined, itemFilters: string[] | undefined, storage: DurableObjectStorage }): Promise<{ inserts: number, updates: number, index1Writes: number, index2Writes: number, ignored: number }> {
    const { feedRecordId, showUuid, podcastGuid, itemFilters = [], storage } = opts;
    const map = await storage.list({ prefix: computeFeedItemRecordKeyPrefix(feedRecordId) });
    let inserts = 0;
    let updates = 0;
    let index1Writes = 0;
    let index2Writes = 0;
    let ignored = 0;
    const index1Records: Record<string, Record<string, unknown>> = {};
    const index2Records: Record<string, ShowEpisodesByPubdateIndexRecord> = {};
    const epRecords: Record<string, EpisodeRecord> = {};
    for (const batch of chunk([...map.values()].filter(isFeedItemRecord), 128)) {
        const itemGuids = batch.map(v => v.guid);
        const episodeIds = await Promise.all(itemGuids.map(computeEpisodeId));
        const episodeKeys = episodeIds.map(v => computeEpisodeKey({ showUuid, id: v }));
        const map = await storage.get(episodeKeys);
        for (let i = 0; i < batch.length; i++) {
            const feedItem = batch[i];
            const itemGuid = itemGuids[i];
            const episodeId = episodeIds[i];
            const episodeKey = episodeKeys[i];
            const existing = map.get(episodeKey);
            const { title, pubdate, pubdateInstant, hasTranscripts, relevantUrls } = feedItem;
            if (itemFilters.length > 0) {
                const urls = Object.values(relevantUrls);
                const meetsFilter = itemFilters.some(filter => urls.some(url => url.includes(filter)));
                if (!meetsFilter) {
                    ignored++;
                    continue;
                }
            }
            if (isEpisodeRecord(existing)) {
                const firstSeenInstant = [ feedItem.firstSeenInstant, existing.firstSeenInstant ].filter(isString).sort()[0];
                const lastSeenInstant = [ feedItem.lastSeenInstant, existing.lastSeenInstant ].filter(isString).sort().reverse()[0];
                if (title !== existing.title || pubdate !== existing.pubdate || pubdateInstant !== existing.pubdateInstant || firstSeenInstant !== existing.firstSeenInstant || lastSeenInstant !== existing.lastSeenInstant || hasTranscripts !== existing.hasTranscripts) {
                    const update: EpisodeRecord = { ...existing, title, pubdate, pubdateInstant, firstSeenInstant, lastSeenInstant, hasTranscripts };
                    epRecords[computeEpisodeKey(update)] = update;
                    updates++;
                }
            } else {
                const { firstSeenInstant, lastSeenInstant } = feedItem;
                const insert: EpisodeRecord = { showUuid, id: episodeId, itemGuid, title, pubdate, pubdateInstant, firstSeenInstant, lastSeenInstant, hasTranscripts };
                epRecords[computeEpisodeKey(insert)] = insert;
                inserts++;
            }
            index1Records[computeShowEpisodesIndexKey(showUuid, episodeId)] = {};
            index1Writes++;
            if (pubdateInstant) {
                index2Records[computeShowEpisodesByPubdateIndexKey({ pubdateInstant, episodeId, showUuid })] = { showUuid, podcastGuid, episodeId, itemGuid, pubdateInstant, hasTranscripts };
                index2Writes++;
            }
        }
    }
    for (const batch of chunk([...Object.entries(epRecords), ...Object.entries(index1Records), ...Object.entries(index2Records)], 128)) {
        await storage.put(Object.fromEntries(batch));
    }
    return { inserts, updates, index1Writes, index2Writes, ignored };
}

type LookupShowMetrics = { messages: string[], storageListCalls: number, indexRecordsScanned: number, feedItemGetCalls: number, feedGetCalls: number, episodeGetCalls: number };

function newLookupShowMetrics(): LookupShowMetrics {
    return { messages: [], storageListCalls: 0, indexRecordsScanned: 0, feedItemGetCalls: 0, feedGetCalls: 0, episodeGetCalls: 0 };
}

async function lookupShow(url: string, storage: DurableObjectStorage, metrics: LookupShowMetrics): Promise<{ showUuid: string, episodeId?: string } | undefined> {
    const destinationUrl = computeChainDestinationUrl(url);
    if (!destinationUrl) return undefined;
    url = destinationUrl;
    const { messages } = metrics;
    for (const queryless of [ false, true ]) {
        const matchUrl = computeMatchUrl(url, { queryless });
        messages.push(`${queryless ? 'querylessMatchUrl' : 'matchUrl'}: ${matchUrl}`);
        const indexType = queryless ? IndexType.QuerylessMatchUrlToFeedItem : IndexType.MatchUrlToFeedItem;

        const map = await storage.list({ prefix: `sc.i0.${indexType}.${matchUrl.substring(0, 1024)}.`});
        metrics.storageListCalls++;
        metrics.indexRecordsScanned += map.size;
        const feedItemRecordKeys = [...map.values()].filter(isFeedItemIndexRecord).map(v => v.feedItemRecordKey);
        messages.push(`${feedItemRecordKeys.length} feedItemRecordKeys`);
        if (feedItemRecordKeys.length === 0) continue;

        // load matching feed item records
        const feedItemRecords = new Map<string, FeedItemRecord>();
        for (const batch of chunk(feedItemRecordKeys, 128)) {
            metrics.feedItemGetCalls++;
            for (const [ key, value ] of await storage.get(batch)) {
                if (isFeedItemRecord(value)) {
                    feedItemRecords.set(key, value);
                }
            }
        }
        messages.push(`${feedItemRecords.size} FeedItemRecords`);

        // and associated feed records (with shows)
        const feedRecordKeys = distinct([...feedItemRecords.values()].map(v => computeFeedRecordKey(v.feedRecordId)));
        messages.push(`${feedRecordKeys.length} feedRecordKeys`);
        const showFeedRecords = new Map<string, FeedRecord>();
        for (const batch of chunk(feedRecordKeys, 128)) {
            metrics.feedGetCalls++;
            for (const [ key, value ] of await storage.get(batch)) {
                if (isFeedRecord(value) && typeof value.showUuid === 'string') {
                    showFeedRecords.set(key, value);
                }
            }
        }
        messages.push(`${showFeedRecords.size} showFeedRecords`);

        const showUuids = new Set([...showFeedRecords.values()].map(v => v.showUuid!));
        if (showUuids.size === 0) continue;
        if (showUuids.size === 1) {
            // bingo
            const showUuid = [...showUuids][0];
            const feedRecord = [...showFeedRecords.values()].find(v => v.showUuid === showUuid)!;
            const itemGuids = [...feedItemRecords.values()].filter(v => v.feedRecordId === feedRecord.id).map(v => v.guid);
            let episodeId: string | undefined;
            if (itemGuids.length === 1) {
                const [ itemGuid ] = itemGuids;
                messages.push(`itemGuid: ${itemGuid}`);
                const candidateEpisodeId = await computeEpisodeId(itemGuid);
                metrics.episodeGetCalls++;
                const episode = await storage.get(computeEpisodeKey({ showUuid, id: candidateEpisodeId }));
                if (isEpisodeRecord(episode)) {
                    episodeId = candidateEpisodeId;
                }
            }
            return { showUuid, episodeId };
        }
        throw new Error(`Matches multiple shows: ${[...showUuids].join(', ')}`);
    }
}

async function deleteShow(showUuid: string, storage: DurableObjectStorage) {
    check('showUuid', showUuid, isValidUuid);
    const feed = (await loadFeedRecords(storage)).filter(isFeedRecord).find(v => v.showUuid === showUuid);
    if (feed) throw new Error(`Cannot delete show ${showUuid} referenced by ${feed.id} (${feed.url})`);

    const showKey = computeShowKey(showUuid);
    const show = await storage.get(showKey);
    const showKeys = show ? [ showKey ] : [];
    const indexKeys = [...(await storage.list({ prefix: computeShowEpisodesIndexKeyPrefix({ showUuid })})).keys()];
    if (isShowRecord(show)) {
        const { podcastGuid } = show;
        if (podcastGuid) indexKeys.push(computePodcastGuidToShowUuidIndexKey({ podcastGuid }));
    }
    const episodeKeys = [...(await storage.list({ prefix: computeEpisodeKeyPrefix({ showUuid })})).keys()];
    const keysToDelete = [
        ...indexKeys,
        ...episodeKeys,
        ...showKeys,
    ];
    for (const batch of chunk(keysToDelete, 128)) {
        await storage.delete(batch);
    }
    return { deletedIndexRecords: indexKeys.length, deletedEpisodeKeys: episodeKeys.length, deletedShowRecords: showKeys.length };
}

function computeFeedRecordKey(feedRecordId: string): string {
    return `sc.fr0.${feedRecordId}`;
}

async function computeFeedRecordId(feedUrl: string): Promise<string> {
    return (await Bytes.ofUtf8(feedUrl).sha256()).hex();
}

function computeFeedItemRecordKey(feedRecordId: string, feedItemRecordId: string): string {
    return `sc.fir0.${feedRecordId}.${feedItemRecordId}`;
}

function computeFeedItemRecordKeyPrefix(feedRecordId: string): string {
    return `sc.fir0.${feedRecordId}.`;
}

async function computeFeedItemRecordId(itemGuid: string): Promise<string> {
    return (await Bytes.ofUtf8(itemGuid).sha256()).hex();
}

async function computeNewPodcastGuids(podcastGuids: Set<string>, storage: DurableObjectStorage): Promise<Set<string>> {
    const rt = new Set(podcastGuids);
    for (const batch of chunk([...podcastGuids], 128)) {
        const revmap = Object.fromEntries(batch.map(v => [ computePodcastGuidIndexKey(v), v ]));
        const map = await storage.get(Object.keys(revmap));
        for (const key of map.keys()) {
            rt.delete(revmap[key]);
        }
    }
    return rt;
}

async function savePodcastGuidIndexRecords(podcastGuids: Set<string>, storage: DurableObjectStorage) {
    for (const batch of chunk([...podcastGuids], 128)) {
        const values = Object.fromEntries(batch.map(v => [ computePodcastGuidIndexKey(v), { podcastGuid: v, state: 'pending' }]));
        await storage.put(values);
    }
}

async function loadFeedRecordIdsToShowUuids(storage: DurableObjectStorage): Promise<Map<string, string>> {
    return new Map([...await storage.list({ prefix: computeFeedRecordIdToShowUuidIndexKeyPrefix() })].map(([ key, value ]) => {
        const { feedRecordId } = unpackFeedRecordIdToShowUuidIndexKey(key);
        if (typeof value !== 'string') throw new Error(`Unexpected index value for key ${key}: ${JSON.stringify(value)}`);
        return [ feedRecordId, value ];
    }));
}

async function loadKnownMediaUrls({ feedRecordId, storage }: { feedRecordId: string, storage: DurableObjectStorage }): Promise<Record<string, MediaUrlIndexRecord>> {
    const map = await storage.list({ prefix: computeFeedMediaUrlsIndexKeyPrefix({ feedRecordId }) });
    const records = [...map.values()].filter(isMediaUrlIndexRecord);
    return Object.fromEntries(records.map(v => [ v.url, v ]));
}

async function loadShowPartitions(storage: DurableObjectStorage): Promise<ShowPartitionsRecord> {
    const result = await storage.get(computeShowPartitionsKey());
    return isShowPartitionsRecord(result) ? result : { partitions: {} };
}

async function rebuildPodcastGuidToShowUuidIndex(storage: DurableObjectStorage) {
    const oldKeys = [...(await storage.list({ prefix: computePodcastGuidToShowUuidIndexKeyPrefix() })).keys()];
    for (const batch of chunk(oldKeys, 128)) {
        await storage.delete(batch);
    }
    const map = await storage.list({ prefix: computeShowKeyPrefix() });
    const shows = [...map.values()].filter(isShowRecord);
    const indexRecords: Record<string, string> = {};
    for (const { uuid: showUuid, podcastGuid } of shows) {
        if (podcastGuid && isValidUuid(showUuid)) indexRecords[computePodcastGuidToShowUuidIndexKey({ podcastGuid })] = showUuid;
    }
    for (const batch of chunk(Object.entries(indexRecords), 128)) {
        await storage.put(Object.fromEntries(batch));
    }

    return { shows: shows.length, oldIndexRecords: oldKeys.length, newIndexRecords: Object.keys(indexRecords).length };
}

async function rebuildMatchUrlToFeedItemIndex({ indexType, storage, go }: { indexType: IndexType, storage: DurableObjectStorage, go: boolean }) {
    const prefix = indexType === IndexType.MatchUrlToFeedItem ? computeMatchUrlToFeedItemIndexKeyPrefix()
        : indexType === IndexType.QuerylessMatchUrlToFeedItem ? computeQuerylessMatchUrlToFeedItemIndexKeyPrefix()
        : undefined;
    if (prefix === undefined) throw new Error();
    const map = await storage.list({ prefix });
    const badKeys: string[] = [];
    const badValueKeys: string[] = [];
    let good = 0;
    for (const [ key, value ] of map) {
        try {
            unpackMatchUrlToFeedItemIndexKey(key);
        } catch {
            badKeys.push(key);
            continue;
        }
        if (!isFeedItemIndexRecord(value)) {
            badValueKeys.push(key);
            continue;
        }
        good++;
    }

    if (go) {
        for (const batch of chunk([ ...badKeys, ...badValueKeys ], 128)) {
            await storage.delete(batch);
        }
    }

    return { badKeys: badKeys.length, badValueKeys: badValueKeys.length, good, go };
}

export type PodcastGuidCallState = Record<string, { blocked?: boolean, calls: { podcastGuid: string, found?: boolean, time: string }[] }>;

function incrementPodcastGuidLookup({ podcastGuid, found, rawIpAddress, state }: { podcastGuid: string, found: boolean, rawIpAddress: string, state: PodcastGuidCallState }) {
    const record = state[rawIpAddress] ?? { calls: [] };
    state[rawIpAddress] = record;
    const now = new Date();
    record.calls.unshift({ podcastGuid, time: now.toISOString(), found: found || undefined });
    while (record.calls.length > 500) record.calls.pop();

    const removeBefore = addHours(now, -2).toISOString();
    const oldKeys = Object.entries(state).filter(v => v[1].calls[0].time < removeBefore).map(v => v[0]);
    oldKeys.forEach(v => delete state[v]);

    let newest: string | undefined;
    const pgs = new Set<string>();
    for (const { time, found, podcastGuid } of record.calls) {
        if (found) continue;
        if (newest === undefined) newest = time;
        pgs.add(podcastGuid);
        if (pgs.size >= 10) {
            const diff = (new Date(newest).getTime() - new Date(time).getTime()) / 1000;
            if (diff <= 60) record.blocked = true;
            break;
        }
    }
}

enum IndexType {
    PodcastGuid = 1,
    MatchUrlToFeedItem = 2,
    QuerylessMatchUrlToFeedItem = 3,
    FeedRecordIdToShowUuid = 4,
    ShowEpisodes = 5,
    FeedMediaUrls = 6,
    ShowEpisodesByPubdate = 7,
    PodcastGuidToShowUuid = 8,
}

function computePodcastGuidIndexKey(podcastGuid: string) {
    return `sc.i0.${IndexType.PodcastGuid}.${podcastGuid}`;
}

function computeMatchUrlToFeedItemIndexKey(matchUrl: string, feedRecordId: string, feedItemRecordId: string) {
    return `sc.i0.${IndexType.MatchUrlToFeedItem}.${matchUrl.substring(0, 1024)}.${feedRecordId}.${feedItemRecordId}`;
}

function unpackMatchUrlToFeedItemIndexKey(key: string): { matchUrl1024: string, feedRecordId: string, feedItemRecordId: string } {
    const [ _, matchUrl1024, feedRecordId, feedItemRecordId ] = checkMatches('key', key, /^sc\.i0\.\d+\.(.*?)\.([0-9a-f]+?)\.([0-9a-f]+?)$/);
    return { matchUrl1024, feedRecordId, feedItemRecordId };
}

function computeMatchUrlToFeedItemIndexKeyPrefix() {
    return `sc.i0.${IndexType.MatchUrlToFeedItem}.`;
}

function computeQuerylessMatchUrlToFeedItemIndexKey(matchUrl: string, feedRecordId: string, feedItemRecordId: string) {
    return `sc.i0.${IndexType.QuerylessMatchUrlToFeedItem}.${matchUrl.substring(0, 1024)}.${feedRecordId}.${feedItemRecordId}`;
}

function computeQuerylessMatchUrlToFeedItemIndexKeyPrefix() {
    return `sc.i0.${IndexType.QuerylessMatchUrlToFeedItem}.`;
}

function computeFeedRecordIdToShowUuidIndexKey(feedRecordId: string) {
    return `sc.i0.${IndexType.FeedRecordIdToShowUuid}.${feedRecordId}`;
}

function unpackFeedRecordIdToShowUuidIndexKey(key: string): { feedRecordId: string } {
    const [ _, feedRecordId ] = checkMatches('key', key, /^sc\.i0\.\d+\.([0-9a-f]+?)$/);
    return { feedRecordId };
}

function computeFeedRecordIdToShowUuidIndexKeyPrefix() {
    return `sc.i0.${IndexType.FeedRecordIdToShowUuid}.`;
}

function computeShowEpisodesIndexKey(showUuid: string, episodeId: string) {
    return `sc.i0.${IndexType.ShowEpisodes}.${showUuid}.${episodeId}`;
}

function computeShowEpisodesIndexKeyPrefix({ showUuid }: { showUuid: string }) {
    return `sc.i0.${IndexType.ShowEpisodes}.${showUuid}.`;
}

function computeShowKey(showUuid: string): string {
    return `sc.show0.${showUuid}`;
}

function computeShowKeyPrefix(): string {
    return 'sc.show0.';
}

export function computeShowgroupKey(showgroupId: string): string {
    return `sc.showgroup0.${showgroupId}`;
}

function computeShowgroupKeyPrefix(): string {
    return 'sc.showgroup0.';
}

async function computeEpisodeId(itemGuid: string): Promise<string> {
    return (await Bytes.ofUtf8(itemGuid).sha256()).hex();
}

function computeEpisodeKey({ showUuid, id }: { showUuid: string, id: string }): string {
    return `sc.ep0.${showUuid}.${id}`;
}

function computeEpisodeKeyPrefix({ showUuid }: { showUuid: string }): string {
    return `sc.ep0.${showUuid}.`;
}

function computeFeedMediaUrlsIndexKey({ feedRecordId, url }: { feedRecordId: string, url: string }) {
    return `sc.i0.${IndexType.FeedMediaUrls}.${feedRecordId}.${url.substring(0, 1024)}`;
}

function computeFeedMediaUrlsIndexKeyPrefix({ feedRecordId }: { feedRecordId: string }) {
    return `sc.i0.${IndexType.FeedMediaUrls}.${feedRecordId}.`;
}

function computeShowEpisodesByPubdateIndexKey({ pubdateInstant, showUuid, episodeId }: { pubdateInstant: string, showUuid: string, episodeId: string }) {
    return `sc.i0.${IndexType.ShowEpisodesByPubdate}.${pubdateInstant}.${showUuid}.${episodeId}`;
}

function computePodcastGuidToShowUuidIndexKey({ podcastGuid }: { podcastGuid: string }) {
    return `sc.i0.${IndexType.PodcastGuidToShowUuid}.${podcastGuid}`;
}

function computePodcastGuidToShowUuidIndexKeyPrefix() {
    return `sc.i0.${IndexType.PodcastGuidToShowUuid}.`;
}

function computeShowPartitionsKey() {
    return `sc.partitions`;
}

