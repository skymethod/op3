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
            newRecords[`fn.1.${feedNotificationSequence.next()}`] = trimRecordToFit({ sent, received, sender, feed });
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

function trimRecordToFit(record: FeedNotificationRecord): FeedNotificationRecord {
    while (true) {
        const json = JSON.stringify(record);
        const size = new TextEncoder().encode(json).length;
        if (size > 1024 * 128) {
            const { items } = record.feed;
            if (Array.isArray(items) && items.length > 0) {
                items.pop();
            } else {
                return record;
            }
        } else {
            return record;
        }
    }
}