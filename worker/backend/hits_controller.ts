import { timed } from '../async.ts';
import { DurableObjectStorage } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, LogRawRedirectsBatchRequest, LogRawRedirectsBatchResponse, Unkinded } from '../rpc_model.ts';
import { writeTraceEvent, consoleError } from '../tracer.ts';
import { AttNums } from './att_nums.ts';
import { IpAddressEncryptionFn, IpAddressHashingFn, packRawRedirect } from './raw_redirects.ts';

export class HitsController {
    private readonly storage: DurableObjectStorage;
    private readonly state: State;
    private readonly encryptIpAddress: IpAddressEncryptionFn;
    private readonly hashIpAddress: IpAddressHashingFn;

    private attNums: AttNums | undefined;

    constructor(storage: DurableObjectStorage, colo: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn) {
        this.storage = storage;
        this.state = { colo, batches: [] };
        this.encryptIpAddress = encryptIpAddress;
        this.hashIpAddress = hashIpAddress;
    }

    async logRawRedirectsBatch(request: Unkinded<LogRawRedirectsBatchRequest>): Promise<Unkinded<LogRawRedirectsBatchResponse>> {
        const { rawRedirectsByMessageId, rpcSentTime } = request;
        const { state, encryptIpAddress, hashIpAddress } = this;
        const rpcReceivedTime = new Date().toISOString();
        const redirectCount = Object.values(rawRedirectsByMessageId).reduce((a, b) => a + b.rawRedirects.length, 0);
        const sortedTimestamps = Object.values(rawRedirectsByMessageId).map(v => v.timestamp).sort();
        const minTimestamp = sortedTimestamps.at(0);
        const maxTimestamp = sortedTimestamps.at(-1);
        const messageIds = Object.keys(rawRedirectsByMessageId);
        const messageCount = messageIds.length;
        
        // TODO save to aggregated minute files
        const times: Record<string, number> = {};
        const attNums = await this.getOrLoadAttNums();
        const attNumsMaxBefore = attNums.max();
        for (const [ messageId, { rawRedirects, timestamp } ] of Object.entries(rawRedirectsByMessageId)) {
            for (const rawRedirect of rawRedirects) {
                const record = await timed(times, 'packRawRedirects', () => packRawRedirect(rawRedirect, attNums, state.colo, 'hits', encryptIpAddress, hashIpAddress));
            }
        }
        if (attNums.max() !== attNumsMaxBefore) {
            await timed(times, 'saveAttNums', () => this.storage.transaction(async txn => {
                    const record = attNums.toJson();
                    console.log(`saveAttNums: ${JSON.stringify(record)}`);
                    await txn.put('hits.attNums', record);
            }));
        }
        const { packRawRedirects, saveAttNums } = times;
       
        // update state
        state.batches.push({ rpcSentTime, rpcReceivedTime, minTimestamp, maxTimestamp, messageCount, redirectCount });
        while (state.batches.length > 50) state.batches.shift();

        // summary analytics
        writeTraceEvent({ kind: 'generic', type: 'hits-batch', strings: [ rpcSentTime, rpcReceivedTime, minTimestamp ?? '', maxTimestamp ?? '' ], doubles: [ messageCount, redirectCount, packRawRedirects ?? 0, saveAttNums ?? 0 ] });

        // TODO consider them all acked for now
        return { messageIds };
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        await Promise.resolve();
        const { operationKind, targetPath } = req;
        if (operationKind === 'select' && targetPath === '/hits/state') return { results: [ this.state ] };

        throw new Error(`Unsupported hits query`);
    }

    //

    private async getOrLoadAttNums(): Promise<AttNums> {
        if (!this.attNums) this.attNums = await loadAttNums(this.storage);
        return this.attNums;
    }

}

//

type State = { colo: string, batches: { rpcSentTime: string, rpcReceivedTime: string, minTimestamp?: string, maxTimestamp?: string, messageCount: number, redirectCount: number }[] };

async function loadAttNums(storage: DurableObjectStorage): Promise<AttNums> {
    const record = await storage.get('hits.attNums');
    console.log(`loadAttNums: ${JSON.stringify(record)}`);
    try {
        if (record !== undefined) return AttNums.fromJson(record);
    } catch (e) {
        consoleError('hits-loading-attnums', `Error loading AttNums from record ${JSON.stringify(record)}: ${e.stack || e}`);
    }
    return new AttNums();
}

