import { DurableObjectStorage } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, LogRawRedirectsBatchRequest, LogRawRedirectsBatchResponse, Unkinded } from '../rpc_model.ts';
import { writeTraceEvent } from '../tracer.ts';

export class HitsController {
    private readonly storage: DurableObjectStorage;
    private readonly state: State;

    constructor(storage: DurableObjectStorage, colo: string) {
        this.storage = storage;
        this.state = { colo, batches: [] };
    }

    async logRawRedirectsBatch(request: Unkinded<LogRawRedirectsBatchRequest>): Promise<Unkinded<LogRawRedirectsBatchResponse>> {
        await Promise.resolve();
        const { rawRedirectsByMessageId, rpcSentTime } = request;
        const rpcReceivedTime = new Date().toISOString();
        const messageIds = Object.keys(rawRedirectsByMessageId);
        const redirectCount = Object.values(rawRedirectsByMessageId).reduce((a, b) => a + b.rawRedirects.length, 0);
        const sortedTimestamps = Object.values(rawRedirectsByMessageId).map(v => v.timestamp).sort();
        const minTimestamp = sortedTimestamps.at(0);
        const maxTimestamp = sortedTimestamps.at(-1);
        const messageCount = messageIds.length;

        // update state
        this.state.batches.push({ rpcSentTime, rpcReceivedTime, minTimestamp, maxTimestamp, messageCount, redirectCount });
        while (this.state.batches.length > 50) this.state.batches.shift();

        // summary analytics
        writeTraceEvent({ kind: 'generic', type: 'hits-batch', strings: [ rpcSentTime, rpcReceivedTime, minTimestamp ?? '', maxTimestamp ?? '' ], doubles: [ messageCount, redirectCount ] });

        // TODO perform packRawRedirect from redirect_log_controller
        // TODO save to aggregated minute files
        return { messageIds };
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        await Promise.resolve();
        const { operationKind, targetPath } = req;
        if (operationKind === 'select' && targetPath === '/hits/state') return { results: [ this.state ] };

        throw new Error(`Unsupported hits query`);
    }

}

//

type State = { colo: string, batches: { rpcSentTime: string, rpcReceivedTime: string, minTimestamp?: string, maxTimestamp?: string, messageCount: number, redirectCount: number }[] };
