import { isStringRecord, isValidGuid } from '../check.ts';
import { Bytes, chunk, DurableObjectStorage } from '../deps.ts';
import { PodcastIndexClient } from '../podcast_index_client.ts';
import { AdminDataRequest, AdminDataResponse, AlarmPayload, ExternalNotificationRequest, Unkinded } from '../rpc_model.ts';
import { computeStartOfYearTimestamp, computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { consoleInfo, consoleWarn } from '../tracer.ts';
import { tryCleanUrl } from '../urls.ts';
import { generateUuid } from '../uuid.ts';
import { FeedRecord, isFeedRecord, isWorkRecord, PodcastIndexFeed, WorkRecord } from './show_controller_model.ts';
import { ShowControllerNotifications } from './show_controller_notifications.ts';
import { computeListOpts } from './storage.ts';

export class ShowController {
    static readonly processAlarmKind = 'ShowController.processAlarmKind';

    private readonly storage: DurableObjectStorage;
    private readonly podcastIndexClient: PodcastIndexClient;
    private readonly notifications: ShowControllerNotifications;

    constructor(storage: DurableObjectStorage, podcastIndexClient: PodcastIndexClient, origin: string) {
        this.storage = storage;
        this.podcastIndexClient = podcastIndexClient;
        this.notifications = new ShowControllerNotifications(storage, origin);
        this.notifications.callbacks = {
            onPodcastGuids: async podcastGuids => {
                const newPodcastGuids = await computeNewPodcastGuids(podcastGuids, storage);
                if (newPodcastGuids.size === 0) return;
                consoleInfo('sc-on-pg', `ShowController: onPodcastGuids: ${[...newPodcastGuids].join(', ')}`);
                await savePodcastGuidIndexRecords(newPodcastGuids, storage);
                await enqueueWork([...newPodcastGuids].map(v => ({ uuid: generateUuid(), kind: 'lookup-pg', podcastGuid: v, attempt: 1 })), storage);
            },
            onFeedUrls: async _feedUrls => {
                // TODO
                await Promise.resolve();
            }
        }
    }

    async receiveExternalNotification({ notification, received } : Unkinded<ExternalNotificationRequest>): Promise<void> {
        await this.notifications.receiveExternalNotification({ notification, received });
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        const res = await this.notifications.adminExecuteDataQuery(req);
        if (res) return res;

        const { operationKind, targetPath, parameters } = req;
        
        if (operationKind === 'select' && targetPath === '/show/feeds') {
            const map = await this.storage.list(computeListOpts('sc.fr0.', parameters));
            const results = [...map.values()].filter(isFeedRecord);
            return { results };
        }

        if (operationKind === 'select' && targetPath === '/show/work') {
            const map = await this.storage.list(computeListOpts('sc.work0.', parameters));
            const results = [...map.values()].filter(isWorkRecord);
            return { results };
        }

        if (operationKind === 'select' && targetPath === '/show/index/podcast-guid') {
            const map = await this.storage.list(computeListOpts(`sc.i0.${IndexType.PodcastGuid}.`, parameters));
            const results = [...map.values()].filter(isStringRecord);
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
            consoleInfo('sc-work', infos.join('; ')); // for now, keep an eye on every call
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

async function lookupPodcastGuid(podcastGuid: string, storage: DurableObjectStorage, client: PodcastIndexClient) {
    let piFeed: PodcastIndexFeed | undefined;
    try {
        const { feed } = await client.getPodcastByGuid(podcastGuid);
        if (typeof feed === 'object' && !Array.isArray(feed)) {
            const { id, podcastGuid: podcastGuidRaw } = feed;
            if (typeof id !== 'number' || id <= 0) throw new Error(`Bad piFeed: ${JSON.stringify(feed)} for podcastGuid ${podcastGuid}`);
            const url = tryCleanUrl(feed.url);
            if (typeof url !== 'string') throw new Error(`Bad piFeed: ${JSON.stringify(feed)} for podcastGuid ${podcastGuid}`);
            const podcastGuidCleaned = typeof podcastGuidRaw === 'string' ? podcastGuidRaw.trim().toLowerCase() : undefined;
            if (typeof podcastGuidCleaned === 'string' && !isValidGuid(podcastGuidCleaned)) throw new Error(`Bad piFeed: ${JSON.stringify(feed)} for podcastGuid ${podcastGuid}`); 
            piFeed = { id, url, podcastGuid: podcastGuidCleaned };
        }
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
