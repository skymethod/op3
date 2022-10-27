import { isStringRecord, isValidGuid } from '../check.ts';
import { Bytes, chunk, DurableObjectStorage } from '../deps.ts';
import { PodcastIndexClient } from '../podcast_index_client.ts';
import { AdminDataRequest, AdminDataResponse, AlarmPayload, ExternalNotificationRequest, Unkinded } from '../rpc_model.ts';
import { computeStartOfYearTimestamp, computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { consoleInfo, consoleWarn } from '../tracer.ts';
import { cleanUrl, tryCleanUrl, tryComputeMatchUrl } from '../urls.ts';
import { generateUuid } from '../uuid.ts';
import { FeedItemRecord, FeedRecord, FeedWorkRecord, getHeader, isFeedItemRecord, isFeedRecord, isWorkRecord, PodcastIndexFeed, WorkRecord } from './show_controller_model.ts';
import { ShowControllerNotifications } from './show_controller_notifications.ts';
import { computeListOpts } from './storage.ts';
import { computeUserAgent } from '../outbound.ts';
import { computeFetchInfo, tryParseBlobKey } from './show_controller_feeds.ts';
import { Blobs } from './blobs.ts';
import { Item, parseFeed } from '../feed_parser.ts';
import { computeChainDestinationUrl } from '../chain_estimate.ts';

export class ShowController {
    static readonly processAlarmKind = 'ShowController.processAlarmKind';

    private readonly storage: DurableObjectStorage;
    private readonly podcastIndexClient: PodcastIndexClient;
    private readonly notifications: ShowControllerNotifications;
    private readonly origin: string;
    private readonly feedBlobs: Blobs;

    constructor(storage: DurableObjectStorage, podcastIndexClient: PodcastIndexClient, origin: string, feedBlobs: Blobs) {
        this.storage = storage;
        this.podcastIndexClient = podcastIndexClient;
        this.origin = origin;
        this.feedBlobs = feedBlobs;
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
                            const insert: FeedRecord = { id: feedRecordId, state: 'new', url: feedUrl };
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

        if (operationKind === 'select' && targetPath === '/show/work') {
            const map = await storage.list(computeListOpts('sc.work0.', parameters));
            const results = [...map.values()].filter(isWorkRecord);
            return { results };
        }

        {
            const m = /^\/show\/index\/(podcast-guid|match-url|queryless-match-url)$/.exec(targetPath);
            if (m && operationKind === 'select') {
                const indexType = {
                    'podcast-guid': IndexType.PodcastGuid,
                    'match-url': IndexType.MatchUrlToFeedItem,
                    'queryless-match-url': IndexType.QuerylessMatchUrlToFeedItem,
                }[m[1]];
                const map = await storage.list(computeListOpts(`sc.i0.${indexType}.`, parameters));
                const results = [...map].filter(v => isStringRecord(v[1])).map(v => ({ _key: v[0], ...v[1] as Record<string, unknown> }));
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
                    if (action === 'update-feed') {
                        const disableConditional = disable.includes('conditional');
                        const disableGzip = disable.includes('gzip');
                        const message = await updateFeed(result, { storage, origin, blobs: feedBlobs, disableConditional, disableGzip });
                        return { message };
                    } else if (action === 'index-items') {
                        const forceResave = force.includes('resave');
                        const message = await indexItems(result, { storage, blobs: feedBlobs, forceResave });
                        return { message };
                    }
                    return { message: 'Unknown update action' };
                }
            }
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
            if (existing) {
                if (isFeedRecord(existing)) {
                    const update: FeedRecord = { ...existing, piFeed, piCheckedInstant };
                    await tx.put(computeFeedRecordKey(feedRecordId), update);
                } else {
                    consoleWarn(`sc-lookup-podcast-guid`, `Failed update bad FeedRecord: ${JSON.stringify(existing)}`);
                }
            } else {
                const insert: FeedRecord = { id: feedRecordId, url: piFeedUrl, state: 'new', piFeed, piCheckedInstant };
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
        const piCheckedInstant = new Date().toISOString();
        const update: FeedRecord = { ...existing, piFeed, piCheckedInstant };
        await tx.put(computeFeedRecordKey(feedRecordId), update);
    });
    // TODO enqueue update-feed if necessary
}

async function updateFeed(feedUrlOrRecord: string | FeedRecord, opts: { storage: DurableObjectStorage, origin: string, blobs: Blobs, disableConditional?: boolean, disableGzip?: boolean }): Promise<string> {
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
    await storage.transaction(async tx => {
        const existing = await tx.get(feedRecordKey);
        if (!isFeedRecord(existing)) return; // deleted?
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
        await tx.put(feedRecordKey, update);
    });
    const contentType = getHeader(fetchInfo.headers, 'content-type');
    if (contentType) rt.push(contentType);
    if (fetchInfo.bodyLength) rt.push(Bytes.formatSize(fetchInfo.bodyLength));
    return rt.join(', ');
}

async function loadFeedRecord(feedUrlOrRecord: string | FeedRecord, storage: DurableObjectStorage): Promise<FeedRecord> {
    const feedRecord = typeof feedUrlOrRecord === 'string' ? await storage.get(computeFeedRecordKey(await computeFeedRecordId(feedUrlOrRecord))) : feedUrlOrRecord;
    if (feedRecord === undefined) throw new Error(`FeedRecord not found: ${feedUrlOrRecord}`);
    if (!isFeedRecord(feedRecord)) throw new Error(`Bad FeedRecord found: ${JSON.stringify(feedRecord)}`);
    return feedRecord;
}

async function indexItems(feedUrlOrRecord: string | FeedRecord, opts: { storage: DurableObjectStorage, blobs: Blobs, forceResave?: boolean }): Promise<string> {
    const { storage, blobs, forceResave = false } = opts;
    const feedRecord = await loadFeedRecord(feedUrlOrRecord, storage);
    const { url: feedUrl } = feedRecord;

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
    if (feedRecord.title !== feed.title) {
        const update: FeedRecord = { ...feedRecord, title: feed.title };
        await storage.put(computeFeedRecordKey(feedRecordId), update);
        rt.push(`updated title from ${feedRecord.title} -> ${feed.title}`);
    }

    const itemsByGuid = Object.fromEntries(feed.items.map(v => [ (v.guid ?? '').trim(), v ]));
    delete itemsByGuid[''];
    rt.push(`${Object.keys(itemsByGuid).length} unique non-empty item guids`);

    const newRecords: Record<string, FeedItemRecord> = {};
    const newIndexRecords: Record<string, { feedItemRecordKey: string }> = {};
    if (forceResave) rt.push('forceResave');
    for (const batch of chunk(Object.entries(itemsByGuid), 128)) {
        const feedItemRecordIds = await Promise.all(batch.map(v => computeFeedItemRecordId(v[1].guid!)));
        const feedItemRecordKeys = feedItemRecordIds.map(v => computeFeedItemRecordKey(feedRecord.id, v));
        const map = await storage.get(feedItemRecordKeys);
        for (let i = 0; i < batch.length; i++) {
            const feedItemRecordId = feedItemRecordIds[i];
            const feedItemRecordKey = feedItemRecordKeys[i];
            const item = batch[i][1];
            let existing = map.get(feedItemRecordKey);
            if (existing !== undefined && !isFeedItemRecord(existing)) {
                consoleWarn('sc-index-items', `Overwriting bad FeedItemRecord(${feedItemRecordKey}): ${JSON.stringify(existing)}`);
                existing = undefined;
            }
            let record = existing;
            const instant = lastOkFetch.responseInstant;
            if (!record) {
                const guid = item.guid!.substring(0, 8 * 1024);
                record = { feedRecordId, id: feedItemRecordId, guid, firstSeenInstant: instant, lastSeenInstant: instant, relevantUrls: {} };
            }
            if (record.lastOkFetch === undefined || instant > record.lastSeenInstant || forceResave) {
                const relevantUrls = computeRelevantUrls(item);
                for (const relevantUrl of Object.values(relevantUrls)) {
                    const destinationUrl = computeChainDestinationUrl(relevantUrl);
                    if (destinationUrl) {
                        const matchUrl = tryComputeMatchUrl(destinationUrl);
                        if (matchUrl) {
                            newIndexRecords[computeMatchUrlToFeedItemIndexKey(matchUrl)] = { feedItemRecordKey };
                            if (matchUrl.includes('?')) {
                                const querylessMatchUrl = tryComputeMatchUrl(destinationUrl, { queryless: true });
                                if (querylessMatchUrl) {
                                    newIndexRecords[computeQuerylessMatchUrlToFeedItemIndexKey(querylessMatchUrl)] = { feedItemRecordKey };
                                }
                            }
                        }
                    }
                }
                const { title, pubdate, pubdateInstant } = item;
                const update: FeedItemRecord = { ...record, lastOkFetch, lastSeenInstant: instant, relevantUrls, title, pubdate, pubdateInstant };
                newRecords[feedItemRecordKey] = update;
            }
        }
    }
    rt.push(`${Object.keys(newRecords).length} FeedItemRecord updates`);
    for (const batch of chunk(Object.entries(newRecords), 128)) {
        await storage.put(Object.fromEntries(batch));
    }
    rt.push(`${Object.keys(newIndexRecords).length} index updates`);
    for (const batch of chunk(Object.entries(newIndexRecords), 128)) {
        await storage.put(Object.fromEntries(batch));
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

function computeFeedRecordKey(feedRecordId: string): string {
    return `sc.fr0.${feedRecordId}`;
}

async function computeFeedRecordId(feedUrl: string): Promise<string> {
    return (await Bytes.ofUtf8(feedUrl).sha256()).hex();
}

function computeFeedItemRecordKey(feedRecordId: string, feedItemRecordId: string): string {
    return `sc.fir0.${feedRecordId}.${feedItemRecordId}`;
}

async function computeFeedItemRecordId(guid: string): Promise<string> {
    return (await Bytes.ofUtf8(guid).sha256()).hex();
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

enum IndexType {
    PodcastGuid = 1,
    MatchUrlToFeedItem = 2,
    QuerylessMatchUrlToFeedItem = 3,
}

function computePodcastGuidIndexKey(podcastGuid: string) {
    return `sc.i0.${IndexType.PodcastGuid}.${podcastGuid}`;
}

function computeMatchUrlToFeedItemIndexKey(matchUrl: string) {
    return `sc.i0.${IndexType.MatchUrlToFeedItem}.${matchUrl.substring(0, 1024)}`;
}

function computeQuerylessMatchUrlToFeedItemIndexKey(matchUrl: string) {
    return `sc.i0.${IndexType.QuerylessMatchUrlToFeedItem}.${matchUrl.substring(0, 1024)}`;
}
