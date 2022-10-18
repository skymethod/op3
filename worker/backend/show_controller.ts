import { isStringRecord } from '../check.ts';
import { DurableObjectStorage } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, ExternalNotificationRequest, Unkinded } from '../rpc_model.ts';
import { TimestampSequence } from './timestamp_sequence.ts';

export class ShowController {

    private readonly storage: DurableObjectStorage;
    private readonly feedNotificationSequence = new TimestampSequence(3);

    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
    }

    async receiveExternalNotification({ notification, received } : Unkinded<ExternalNotificationRequest>): Promise<void> {
        const { type, sent, sender, feeds } = notification;
        const { storage, feedNotificationSequence } = this;

        if (type !== 'feeds') throw new Error(`We only care about feeds notifications`);
        if (!Array.isArray(feeds)) throw new Error(`Expected feeds array`);
        const newRecords: Record<string, FeedNotificationRecord> = {};
        feeds.forEach((feed, i) => {
            if (!isStringRecord(feed)) throw new Error(`Bad feed at index ${i}`);
            const trimmed = trimRecordToFit({ sent, received, sender, feed });
            const length = new TextEncoder().encode(JSON.stringify(trimmed)).length;
            newRecords[`fn.1.${feedNotificationSequence.next()}.${length}`] = trimmed;
        });
        const newRecordsCount = Object.keys(newRecords).length;
        if (newRecordsCount === 0) return;
        console.log(`ShowController: Saving ${newRecordsCount} new feed notification records`);
        await storage.put(newRecords);
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        const { operationKind, targetPath } = req;
        if (operationKind === 'select' && targetPath === '/feed-notifications') {
            const results: FeedNotificationRecord[] = [];
            const map = await this.storage.list({ prefix: 'fn.1.'});
            for (const val of map.values()) {
                if (isFeedNotificationRecord(val)) {
                    results.push(val);
                }
            }
            return { results };
        }
        
        throw new Error(`Unsupported show-related query`);
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

//

interface FeedNotificationRecord {
    readonly sent: string;
    readonly received: string;
    readonly sender: string;
    readonly feed: Record<string, unknown>;
}

function isFeedNotificationRecord(obj: unknown): obj is FeedNotificationRecord {
    return isStringRecord(obj)
        && typeof obj.sent === 'string'
        && typeof obj.received === 'string'
        && typeof obj.sender === 'string'
        && isStringRecord(obj.feed)
        ;
}
