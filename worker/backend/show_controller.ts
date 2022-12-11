import { computeChainDestinationUrl } from '../chain_estimate.ts';
import { check, checkMatches, isString, isStringRecord, isValidGuid } from '../check.ts';
import { Bytes, chunk, distinct, DurableObjectStorage, DurableObjectStorageValue } from '../deps.ts';
import { Item, parseFeed } from '../feed_parser.ts';
import { computeUserAgent } from '../outbound.ts';
import { PodcastIndexClient } from '../podcast_index_client.ts';
import { AdminDataRequest, AdminDataResponse, AlarmPayload, ExternalNotificationRequest, RpcClient, Unkinded } from '../rpc_model.ts';
import { computeStartOfYearTimestamp, computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { consoleInfo, consoleWarn } from '../tracer.ts';
import { cleanUrl, computeMatchUrl, tryCleanUrl, tryComputeMatchUrl } from '../urls.ts';
import { generateUuid, isValidUuid } from '../uuid.ts';
import { Blobs } from './blobs.ts';
import { computeDailyDownloads, computeHourlyDownloads, computeShowDailyDownloads } from './downloads.ts';
import { computeFetchInfo, tryParseBlobKey } from './show_controller_feeds.ts';
import { EpisodeRecord, FeedItemIndexRecord, FeedItemRecord, FeedRecord, FeedWorkRecord, getHeader, isEpisodeRecord, isFeedItemIndexRecord, isFeedItemRecord, isFeedRecord, isShowRecord, isWorkRecord, PodcastIndexFeed, ShowRecord, WorkRecord } from './show_controller_model.ts';
import { ShowControllerNotifications } from './show_controller_notifications.ts';
import { computeListOpts } from './storage.ts';

export class ShowController {
    static readonly processAlarmKind = 'ShowController.processAlarmKind';

    private readonly storage: DurableObjectStorage;
    private readonly podcastIndexClient: PodcastIndexClient;
    private readonly notifications: ShowControllerNotifications;
    private readonly origin: string;
    private readonly feedBlobs: Blobs;
    private readonly statsBlobs: Blobs;
    private readonly rpcClient: RpcClient;

    constructor({ storage, podcastIndexClient, origin, feedBlobs, statsBlobs, rpcClient }: { storage: DurableObjectStorage, podcastIndexClient: PodcastIndexClient, origin: string, feedBlobs: Blobs, statsBlobs: Blobs, rpcClient: RpcClient }) {
        this.storage = storage;
        this.podcastIndexClient = podcastIndexClient;
        this.origin = origin;
        this.feedBlobs = feedBlobs;
        this.statsBlobs = statsBlobs;
        this.rpcClient = rpcClient;
        this.notifications = new ShowControllerNotifications(storage, origin);
        this.notifications.callbacks = {
            onPodcastGuids: async podcastGuids => {
                // for guids we've never seen before, insert pending index records and enqueue lookup-pg work
                const newPodcastGuids = await computeNewPodcastGuids(podcastGuids, storage);
                if (newPodcastGuids.size === 0) return;
                consoleInfo('sc-on-pg', `ShowController: onPodcastGuids: ${[...newPodcastGuids].join(', ')}`);
                await savePodcastGuidIndexRecords(newPodcastGuids, storage);
                await enqueueWork([...newPodcastGuids].map(v => ({ uuid: generateUuid(), kind: 'lookup-pg', podcastGuid: v, attempt: 1 })), storage);
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
                await enqueueWork(work, storage);
            }
        }
    }

    async receiveExternalNotification({ notification, received } : Unkinded<ExternalNotificationRequest>): Promise<void> {
        await this.notifications.receiveExternalNotification({ notification, received });
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        const { notifications, storage, origin, feedBlobs } = this;
        const res = await notifications.adminExecuteDataQuery(req);
        if (res) return res;

        const { operationKind, targetPath, parameters = {} } = req;
        
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
            const map = await storage.list(computeListOpts('sc.show0.', parameters));
            const results = [...map.values()].filter(isShowRecord);
            return { results };
        }

        if (operationKind === 'select' && targetPath === '/show/work') {
            const map = await storage.list(computeListOpts('sc.work0.', parameters));
            const results = [...map.values()].filter(isWorkRecord);
            return { results };
        }

        {
            const m = /^\/show\/index\/(podcast-guid|match-url|queryless-match-url|feed-to-show|show-episodes)$/.exec(targetPath);
            if (m && operationKind === 'select') {
                const indexType = {
                    'podcast-guid': IndexType.PodcastGuid,
                    'match-url': IndexType.MatchUrlToFeedItem,
                    'queryless-match-url': IndexType.QuerylessMatchUrlToFeedItem,
                    'feed-to-show': IndexType.FeedRecordIdToShowUuid,
                    'show-episodes': IndexType.ShowEpisodes,
                }[m[1]];
                const map = await storage.list(computeListOpts(`sc.i0.${indexType}.`, parameters));
                const expectStringValues = indexType === IndexType.FeedRecordIdToShowUuid;
                if (expectStringValues) {
                    const results = [...map].filter(v => typeof v[1] === 'string').map(v => ({ _key: v[0], _value: v[1] as string }));
                    return { results };
                } else {
                    const results = [...map].filter(v => isStringRecord(v[1])).map(v => ({ _key: v[0], ...v[1] as Record<string, unknown> }));
                    return { results };
                }
            }
        }

        {
            const m = /^\/show\/feeds\/(.+?)\/items$/.exec(targetPath);
            if (m && operationKind === 'select') {
                const feedUrl = m[1];
                const feedRecordId = await computeFeedRecordId(cleanUrl(feedUrl));
                const map = await storage.list(computeListOpts(computeFeedItemRecordKeyPrefix(feedRecordId), parameters));
                const results = [...map.values()].filter(isFeedItemRecord);
                return { results };
            }
        }
    
        {
            const m = /^\/show\/feeds\/(.*?)$/.exec(targetPath);
            if (m && (operationKind === 'select' || operationKind === 'update')) {
                const feedUrl = m[1];
                const feedRecordId = await computeFeedRecordId(cleanUrl(feedUrl));
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
                    const { action, disable = '', force = '' } = parameters;
                    if (action === 'update-feed' || action === 'update-feed-and-index-items') {
                        const disableConditional = disable.includes('conditional');
                        const disableGzip = disable.includes('gzip');
                        const { message, updated, fetchStatus } = await updateFeed(result, { storage, origin, blobs: feedBlobs, disableConditional, disableGzip });
                        if (action === 'update-feed-and-index-items' && updated && fetchStatus === 200) {
                            const forceResave = force.includes('resave');
                            const indexItemsMessage = await indexItems(updated, { storage, blobs: feedBlobs, forceResave });
                            return { message: [message, indexItemsMessage ].join(', ') };
                        } else {
                            return { message };
                        }
                    } else if (action === 'index-items') {
                        const forceResave = force.includes('resave');
                        const message = await indexItems(result, { storage, blobs: feedBlobs, forceResave });
                        return { message };
                    } else if (action == 'set-show-uuid') {
                        const { 'show-uuid': showUuid = generateUuid() } = parameters;
                        const message = await setShowUuid(result, showUuid, { storage });
                        return { message };
                    } else if (action == 'remove-show-uuid') {
                        const showUuid = await removeShowUuid(result, storage);
                        return { message: `Removed ${showUuid} from ${result.url}` };
                    }
                    return { message: 'Unknown update action' };
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
            const { hour, date, shows } = parameters;

            // compute hourly download tsv
            if (typeof hour === 'string') {
                const { maxHits: maxHitsStr = '100', querySize: querySizeStr = '100', maxQueries: maxQueriesStr = '10' } = parameters;
                const maxHits = parseInt(maxHitsStr);
                const querySize = parseInt(querySizeStr);
                const maxQueries = parseInt(maxQueriesStr);
                const { rpcClient, statsBlobs } = this;
                const result = await computeHourlyDownloads(hour, { statsBlobs, maxHits, maxQueries, querySize, rpcClient });
                return { results: [ result ] };
            }
            
            // compute daily download tsv
            if (typeof date === 'string') {
                const { statsBlobs } = this;
                if (typeof shows === 'string') {
                    const [ _, modeStr, showsStr ] = checkMatches('shows', shows, /^(include|exclude)=(.*?)$/);
                    const mode = modeStr === 'include' || modeStr === 'exclude' ? modeStr : undefined;
                    if (!mode) throw new Error(`Bad shows: ${shows}`);
                    const showUuids = showsStr.split(',').filter(v => v !== '');
                    const result = await computeShowDailyDownloads(date, { mode, showUuids, statsBlobs } );
                    return { results: [ result ] };
                } else {
                    const { 'part-size': partSizeStr = '20', 'multipart-mode': multipartModeStr } = parameters; // in mb, 20mb is about 50,000 rows
                    const partSizeMb = parseInt(partSizeStr);
                    check('part-size', partSizeMb, partSizeMb >= 5); // r2 minimum multipart size
                    const multipartMode = multipartModeStr === 'bytes' ? 'bytes' : multipartModeStr === 'stream' ? 'stream' : 'bytes';
                    const { lookupShow, preloadMillis, matchUrls, querylessMatchUrls, feedRecordIdsToShowUuids } = await lookupShowBulk(storage);
                    const result = await computeDailyDownloads(date, { multipartMode, partSizeMb, statsBlobs, lookupShow } );
                    return { results: [ { ...result, preloadMillis, matchUrls, querylessMatchUrls, feedRecordIdsToShowUuids } ] };
                }
            }
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

        throw new Error(`Unsupported show-related query`);
    }

    async work(): Promise<void> {
        const { storage, podcastIndexClient } = this;
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
                    } else if (r.kind == 'lookup-feed') {
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
                        await rescheduleAlarm(notBeforeInstant, storage);
                    }
                }
            }
        } finally {
            consoleInfo('sc-work', `ShowController: ${infos.join('; ')}`); // for now, keep an eye on every call
        }
    }
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
    const matchUrls = await loadMatchUrls(computeMatchUrlToFeedItemIndexKeyPrefix());
    const querylessMatchUrls = await loadMatchUrls(computeQuerylessMatchUrlToFeedItemIndexKeyPrefix());
    const feedRecordIdsToShowUuids = await loadFeedRecordIdsToShowUuids(storage);
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
            const matches = (queryless ? querylessMatchUrls : matchUrls).get(matchUrl1024);
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
        }
        return undefined;
    };
    return { lookupShow, preloadMillis, matchUrls: matchUrls.size, querylessMatchUrls: querylessMatchUrls.size, feedRecordIdsToShowUuids: feedRecordIdsToShowUuids.size };
}

//

const WORK_EPOCH_TIMESTAMP = computeStartOfYearTimestamp(2020);
const WORK_EPOCH_INSTANT = timestampToInstant(WORK_EPOCH_TIMESTAMP);

async function rescheduleAlarm(soonestNotBeforeInstant: string, storage: DurableObjectStorage) {
    const soonestNotBeforeTime = new Date(soonestNotBeforeInstant).getTime();
    await storage.transaction(async tx => {
        const alarm = await tx.getAlarm();
        if (typeof alarm === 'number' && alarm <= soonestNotBeforeTime) return;
        await tx.put('alarm.payload', { kind: ShowController.processAlarmKind } as AlarmPayload);
        await tx.setAlarm(soonestNotBeforeTime);
    });
}

async function enqueueWork(work: WorkRecord | WorkRecord[], storage: DurableObjectStorage): Promise<void> {
    const works = Array.isArray(work) ? work : [ work ];
    if (works.length === 0) return;
    for (const batch of chunk(works, 128)) {
        const records = Object.fromEntries(batch.map(v => [ computeWorkRecordKey(v), v ]));
        await storage.put(records);
    }
    const soonestNotBeforeInstant = works.map(v => v.notBeforeInstant ?? WORK_EPOCH_INSTANT).sort()[0];
    await rescheduleAlarm(soonestNotBeforeInstant, storage);
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
        consoleWarn('sc-lookup-podcast-guid', `Error calling getPodcastByGuid: ${e.stack || e}`);
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
        consoleWarn('sc-lookup-podcast-feed', `Error calling getPodcastByFeedUrl: ${e.stack || e}`);
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

async function updateFeed(feedUrlOrRecord: string | FeedRecord, opts: { storage: DurableObjectStorage, origin: string, blobs: Blobs, disableConditional?: boolean, disableGzip?: boolean }): Promise<{ message: string, updated?: FeedRecord, fetchStatus?: number }> {
    const { storage, origin, blobs, disableConditional = false, disableGzip = false } = opts;
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
    const fetchInfo = await computeFetchInfo(feedUrl, headers, blobKeyBase, blobs);
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

async function indexItems(feedUrlOrRecord: string | FeedRecord, opts: { storage: DurableObjectStorage, blobs: Blobs, forceResave?: boolean }): Promise<string> {
    const { storage, blobs, forceResave = false } = opts;
    const feedRecord = await loadFeedRecord(feedUrlOrRecord, storage);
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
    if (feedRecord.title !== feed.title || feedRecord.podcastGuid !== feed.podcastGuid) {
        const update: FeedRecord = { ...feedRecord, title: feed.title, podcastGuid: feed.podcastGuid, updated: new Date().toISOString() };
        await storage.put(computeFeedRecordKey(feedRecordId), update);
        if (feedRecord.title !== feed.title) rt.push(`updated title from ${feedRecord.title} -> ${feed.title}`);
        if (feedRecord.podcastGuid !== feed.podcastGuid) rt.push(`updated podcastGuid from ${feedRecord.podcastGuid} -> ${feed.podcastGuid}`);
    }

    // collect items by trimmed item guid
    const itemsByTrimmedGuid = Object.fromEntries(feed.items.map(v => [ (v.guid ?? '').trim().substring(0, 8 * 1024), v ]));
    delete itemsByTrimmedGuid['']; // only save items with non-empty guids
    rt.push(`${Object.keys(itemsByTrimmedGuid).length} unique non-empty item guids`);

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
                const relevantUrls = computeRelevantUrls(item);
                for (const relevantUrl of Object.values(relevantUrls)) {
                    const destinationUrl = computeChainDestinationUrl(relevantUrl);
                    if (destinationUrl) {
                        const matchUrl = tryComputeMatchUrl(destinationUrl);
                        if (matchUrl) {
                            newIndexRecords[computeMatchUrlToFeedItemIndexKey(matchUrl, feedRecordId, feedItemRecordId)] = { feedItemRecordKey };
                            if (matchUrl.includes('?')) {
                                const querylessMatchUrl = tryComputeMatchUrl(destinationUrl, { queryless: true });
                                if (querylessMatchUrl) {
                                    newIndexRecords[computeQuerylessMatchUrlToFeedItemIndexKey(querylessMatchUrl, feedRecordId, feedItemRecordId)] = { feedItemRecordKey };
                                }
                            }
                        }
                    }
                }
                const { title, pubdate, pubdateInstant } = item;
                const update: FeedItemRecord = { ...record, lastOkFetch, lastSeenInstant: instant, relevantUrls, title, pubdate, pubdateInstant };
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
        await setShowAttributesFromFeed(feedRecord, storage, rt);

        // ensure show episodes exist for all feed items
        const { inserts, updates, indexWrites } = await ensureEpisodesExistForAllFeedItems({ feedRecordId, showUuid, storage });
        if (inserts > 0) rt.push(`${inserts} ep inserts`);
        if (updates > 0) rt.push(`${updates} ep updates`);
        if (indexWrites > 0) rt.push(`${indexWrites} ep index writes`);
    }

    return rt.join(', ');
}

function computeRelevantUrls(item: Item): Record<string, string> {
    const hasOp3Reference = (v: string) => v.includes('op3.dev');
    const rt: Record<string, string> = {};
    if (item.enclosures) {
        item.enclosures.forEach((v, i) => {
            if (v.url && hasOp3Reference(v.url)) {
                rt[`e.${i}.url`] = v.url;
            }
        });
    }
    if (item.alternateEnclosures) {
        item.alternateEnclosures.forEach((v, i) => {
            if (v.sources) {
                v.sources.forEach((w, j) => {
                    if (w.uri && hasOp3Reference(w.uri)) {
                        rt[`ae.${i}.s.${j}.uri`] = w.uri;
                    }
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
        // show already exists, allow only if no piFeed
        if (feedRecord.piFeed !== undefined) throw new Error(`Feed must not have a piFeed`);
    } else {
        if (feedRecord.piFeed === undefined) throw new Error(`Feed must have a piFeed`);
        const { podcastGuid } = feedRecord.piFeed;
        if (podcastGuid === undefined || !isValidGuid(podcastGuid)) throw new Error(`Feed must have a piFeed with a valid podcastGuid`);
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

    // ensure show episodes exist for all feed items
    const { inserts, updates, indexWrites } = await ensureEpisodesExistForAllFeedItems({ feedRecordId: feedRecord.id, showUuid, storage });
    if (inserts > 0) rt.push(`${inserts} ep inserts`);
    if (updates > 0) rt.push(`${updates} ep updates`);
    if (indexWrites > 0) rt.push(`${indexWrites} ep index writes`);

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

async function setShowAttributesFromFeed(feedRecord: FeedRecord, storage: DurableObjectStorage, messages: string[]): Promise<void> {
    const { showUuid } = feedRecord;
    if (!showUuid) return;
    const showKey = computeShowKey(showUuid);
    const show = await storage.get(showKey);
    if (!isShowRecord(show)) return;
    const { title } = feedRecord;
    if (show.title !== title) {
        const update: ShowRecord = { ...show, title };
        await storage.put(showKey, update);
        messages.push(`show.title ${show.title} -> ${ title }`);
    }
}

async function ensureEpisodesExistForAllFeedItems(opts: { feedRecordId: string, showUuid: string, storage: DurableObjectStorage }): Promise<{ inserts: number, updates: number, indexWrites: number }> {
    const { feedRecordId, showUuid, storage } = opts;
    const map = await storage.list({ prefix: computeFeedItemRecordKeyPrefix(feedRecordId) });
    let inserts = 0;
    let updates = 0;
    let indexWrites = 0;
    const indexRecords: Record<string, Record<string, unknown>> = {};
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
            const { title, pubdate, pubdateInstant } = feedItem;
            if (isEpisodeRecord(existing)) {
                const firstSeenInstant = [ feedItem.firstSeenInstant, existing.firstSeenInstant ].filter(isString).sort()[0];
                const lastSeenInstant = [ feedItem.lastSeenInstant, existing.lastSeenInstant ].filter(isString).sort().reverse()[0];
                if (title !== existing.title || pubdate !== existing.pubdate || pubdateInstant !== existing.pubdateInstant || firstSeenInstant !== existing.firstSeenInstant || lastSeenInstant !== existing.lastSeenInstant) {
                    const update: EpisodeRecord = { ...existing, title, pubdate, pubdateInstant, firstSeenInstant, lastSeenInstant };
                    epRecords[computeEpisodeKey(update)] = update;
                    updates++;
                }
            } else {
                const { firstSeenInstant, lastSeenInstant } = feedItem;
                const insert: EpisodeRecord = { showUuid, id: episodeId, itemGuid, title, pubdate, pubdateInstant, firstSeenInstant, lastSeenInstant };
                epRecords[computeEpisodeKey(insert)] = insert;
                inserts++;
            }
            indexRecords[computeShowEpisodesIndexKey(showUuid, episodeId)] = {};
            indexWrites++;
        }
    }
    for (const batch of chunk(Object.entries(epRecords), 128)) {
        await storage.put(Object.fromEntries(batch));
    }
    for (const batch of chunk(Object.entries(indexRecords), 128)) {
        await storage.put(Object.fromEntries(batch));
    }
    return { inserts, updates, indexWrites };
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

enum IndexType {
    PodcastGuid = 1,
    MatchUrlToFeedItem = 2,
    QuerylessMatchUrlToFeedItem = 3,
    FeedRecordIdToShowUuid = 4,
    ShowEpisodes = 5,
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

async function computeEpisodeId(itemGuid: string): Promise<string> {
    return (await Bytes.ofUtf8(itemGuid).sha256()).hex();
}

function computeEpisodeKey({ showUuid, id }: { showUuid: string, id: string }): string {
    return `sc.ep0.${showUuid}.${id}`;
}

function computeEpisodeKeyPrefix({ showUuid }: { showUuid: string }): string {
    return `sc.ep0.${showUuid}.`;
}
