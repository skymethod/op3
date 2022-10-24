import { isStringRecord, isValidInstant } from '../check.ts';
import { DurableObjectStorage } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, ExternalNotificationRequest, Unkinded, UrlInfo } from '../rpc_model.ts';
import { consoleInfo, consoleWarn } from '../tracer.ts';
import { tryParsePrefixArguments } from './prefix_arguments.ts';
import { TimestampSequence } from './timestamp_sequence.ts';
import { tryCleanUrl } from '../urls.ts';
import { computeListOpts } from './storage.ts';

export class ShowControllerNotifications {

    private readonly storage: DurableObjectStorage;
    private readonly origin: string;
    private readonly feedNotificationSequence = new TimestampSequence(3);
    
    callbacks?: ShowControllerNotificationsCallbacks;

    constructor(storage: DurableObjectStorage, origin: string) {
        this.storage = storage;
        this.origin = origin;
    }

    async receiveExternalNotification({ notification, received } : Unkinded<ExternalNotificationRequest>): Promise<boolean> {
        const { type, sent, sender } = notification;
        const { storage, feedNotificationSequence, callbacks, origin } = this;

        if (type === 'feeds') {
            const { feeds } = notification;
            if (!Array.isArray(feeds)) throw new Error(`Expected feeds array`);

            const newRecords: Record<string, FeedNotificationRecord> = {};
            const feedUrls = new Set<string>();
            const feedUrlsFromFa = new Set<string>();
            feeds.forEach((feed, i) => {
                if (!isStringRecord(feed)) throw new Error(`Bad feed at index ${i}`);
                const { feedUrl } = feed;
                if (typeof feedUrl === 'string' && sender === 'fa') feedUrlsFromFa.add(feedUrl);
                const cleanFeedUrl = typeof feedUrl === 'string' && tryCleanUrl(feedUrl);
                if (typeof cleanFeedUrl === 'string') {
                    feedUrls.add(cleanFeedUrl);
                }
                const trimmed = trimRecordToFit({ sent, received, sender, feed });
                const length = new TextEncoder().encode(JSON.stringify(trimmed)).length;
                newRecords[`fn.1.${feedNotificationSequence.next()}.${length}`] = trimmed;
            });
            if (feedUrlsFromFa.size > 0) {
                consoleInfo('sc-feed-not-fa', `ShowController: feedUrlsFromFa: ${[...feedUrlsFromFa].join(', ')}`);
            }
            const newRecordsCount = Object.keys(newRecords).length;
            if (newRecordsCount > 0) {
                console.log(`ShowController: Saving ${newRecordsCount} new feed notification records`);
                await storage.put(newRecords);
            }
            if (feedUrls.size > 0) {
                await callbacks?.onFeedUrls(feedUrls);
            }
            return true;
        }

        if (type === 'urls') {
            const { urls } = notification;
            if (!Array.isArray(urls)) throw new Error(`Expected urls array`);
            const validUrls: UrlInfo[] = [];
            for (const info of urls) {
                const { url, found } = info;
                if (typeof url !== 'string' || typeof found !== 'string' || !isValidInstant(found)) {
                    consoleWarn('sc-bad-url-not', `ShowController: Bad url notification: ${JSON.stringify(info)}`);
                    continue;
                }
                if (!/^https?:\/\//i.test(url)) {
                    consoleWarn('sc-bad-url-not-url', `ShowController: Bad url notification url: ${JSON.stringify(info)}`);
                    continue;
                }
                validUrls.push({ url, found });
            }

            const map = await storage.get(validUrls.map(v => computeUrlKey(v.url)));
            const newRecords: Record<string, UrlRecord> = {};
            const podcastGuids = new Set<string>();
            for (const { url, found } of validUrls) {
                const key = computeUrlKey(url);
                const val = map.get(key);
                const existing = isUrlRecord(val) && val;
                if (existing && existing.found <= found) {
                    // already found it
                    continue;
                }
                const foundSource = notification.sender;
                newRecords[key] = existing ? { ...existing, found, foundSource } : { url, found, foundSource };
                if (!existing) {
                    const { pg } = tryParsePrefixArguments(url, { origin }) ?? {};
                    if (typeof pg === 'string') {
                        podcastGuids.add(pg);
                    }
                }
            }
            const newRecordsCount = Object.keys(newRecords).length;
            if (newRecordsCount > 0) {
                consoleInfo('sc-not',`ShowController: saving ${newRecordsCount} url records (${Object.values(newRecords).map(v => `${v.url} at ${v.found} by ${v.foundSource}`).join(', ')})`);
                await storage.put(newRecords);
            }
            if (podcastGuids.size > 0) {
                await callbacks?.onPodcastGuids(podcastGuids);
            }
            return true;
        }

        return false;
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse> | undefined> {
        const { operationKind, targetPath, parameters } = req;
        
        if (operationKind === 'select' && targetPath === '/feed-notifications') {
            const map = await this.storage.list(computeListOpts('fn.1.', parameters));
            const results = [...map.values()].filter(isFeedNotificationRecord);
            return { results };
        }

        if (operationKind === 'select' && targetPath === '/show/urls') {
            const map = await this.storage.list(computeListOpts('sc.u0.', parameters));
            const results = [...map.values()].filter(isUrlRecord);
            return { results };
        }

        if (targetPath.startsWith('/show/urls/')) {
            const url = targetPath.substring('/show/urls/'.length);
            const key = computeUrlKey(url);
            if (operationKind === 'select') {
                const result = await this.storage.get(key);
                const results = isUrlRecord(result) ? [ result ] : [];
                return { results };
            } else if (operationKind === 'delete') {
                const existed = await this.storage.delete(key);
                return { message: existed ? 'Deleted one record' : 'Record not found' };
            }
        }
    }   
    
}

//

export function trimRecordToFit(record: FeedNotificationRecord): FeedNotificationRecord {
    const { items } = record.feed;
    const hasOp3Reference = (v: unknown) => Array.isArray(v) && v.some(v => typeof v === 'string' && v.includes('op3.dev')); 
    if (Array.isArray(items)) {
        const newItems = items.filter(v => isStringRecord(v) && (hasOp3Reference(v.enclosureUrls) || hasOp3Reference(v.alternateEnclosureUris)));
        for (const item of newItems) {
            const { enclosureUrls, alternateEnclosureUris } = item;
            if (Array.isArray(enclosureUrls) && enclosureUrls.length === 0) delete item.enclosureUrls;
            if (Array.isArray(alternateEnclosureUris) && alternateEnclosureUris.length === 0) delete item.alternateEnclosureUris;
        }
        record.feed.items = newItems;
    }
    while (true) {
        const json = JSON.stringify(record);
        const size = new TextEncoder().encode(json).length;
        if (size > 1024 * 90) { // max 128 kb, but needs some headroom
            const { items } = record.feed;
            if (Array.isArray(items) && items.length > 0) {
                if (items.length > 500) {
                    items.splice(500);
                } else {
                    items.pop();
                }
            } else {
                return record;
            }
        } else {
            return record;
        }
    }
}

export interface FeedNotificationRecord {
    readonly sent: string;
    readonly received: string;
    readonly sender: string;
    readonly feed: Record<string, unknown>;
}

export function isFeedNotificationRecord(obj: unknown): obj is FeedNotificationRecord {
    return isStringRecord(obj)
        && typeof obj.sent === 'string'
        && typeof obj.received === 'string'
        && typeof obj.sender === 'string'
        && isStringRecord(obj.feed)
        ;
}

export interface ShowControllerNotificationsCallbacks {
    onPodcastGuids(podcastGuids: Set<string>): Promise<void>;
    onFeedUrls(feedUrls: Set<string>): Promise<void>;
}

//

function computeUrlKey(url: string): string {
    return `sc.u0.${url.substring(0, 1024)}`;
}

//

interface UrlRecord {
    readonly url: string;
    readonly found: string; // earliest time seen
    readonly foundSource: string; // responsible for earliest time seen
}

function isUrlRecord(obj: unknown): obj is UrlRecord {
    return isStringRecord(obj)
        && typeof obj.url === 'string'
        && typeof obj.found === 'string'
        && typeof obj.foundSource === 'string'
        ;
}
