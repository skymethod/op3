import { isStringRecord, isValidGuid } from '../check.ts';
import { Bytes, chunk, DurableObjectStorage } from '../deps.ts';
import { PodcastIndexClient } from '../podcast_index_client.ts';
import { AdminDataRequest, AdminDataResponse, AlarmPayload, ExternalNotificationRequest, Unkinded } from '../rpc_model.ts';
import { computeStartOfYearTimestamp, computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { consoleInfo, consoleWarn } from '../tracer.ts';
import { cleanUrl, tryCleanUrl } from '../urls.ts';
import { generateUuid } from '../uuid.ts';
import { FeedRecord, FeedWorkRecord, getHeader, isFeedRecord, isWorkRecord, PodcastIndexFeed, WorkRecord } from './show_controller_model.ts';
import { ShowControllerNotifications } from './show_controller_notifications.ts';
import { computeListOpts } from './storage.ts';
import { computeUserAgent } from '../outbound.ts';
import { computeFetchInfo, tryParseBlobKey } from './show_controller_feeds.ts';
import { Blobs } from './blobs.ts';

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

        if (operationKind === 'select' && targetPath === '/show/index/podcast-guid') {
            const map = await storage.list(computeListOpts(`sc.i0.${IndexType.PodcastGuid}.`, parameters));
            const results = [...map.values()].filter(isStringRecord);
            return { results };
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
                    const { action, disable = '' } = parameters;
                    if (action === 'update-feed') {
                        const disableConditional = disable.includes('conditional');
                        const disableGzip = disable.includes('gzip');
                        const message = await updateFeed(result.url, { storage, origin, blobs: feedBlobs, disableConditional, disableGzip });
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
    const feedRecord = typeof feedUrlOrRecord === 'string' ? await storage.get(computeFeedRecordKey(await computeFeedRecordId(feedUrlOrRecord))) : feedUrlOrRecord;
    if (feedRecord === undefined) return `FeedRecord not found: ${feedUrlOrRecord}`;
    if (!isFeedRecord(feedRecord)) return `Bad FeedRecord found: ${JSON.stringify(feedRecord)}`;
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

function computeFeedRecordKey(feedRecordId: string): string {
    return `sc.fr0.${feedRecordId}`;
}

async function computeFeedRecordId(feedUrl: string): Promise<string> {
    return (await Bytes.ofUtf8(feedUrl).sha256()).hex();
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
}

function computePodcastGuidIndexKey(podcastGuid: string) {
    return `sc.i0.${IndexType.PodcastGuid}.${podcastGuid}`;
}
