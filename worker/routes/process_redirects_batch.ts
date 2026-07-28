import { QueueMessage } from '../deps.ts';
import { DoNames } from '../do_names.ts';
import { RawRedirect, RpcClient } from '../rpc_model.ts';
import { writeTraceEvent } from '../tracer.ts';
import { generateUuid } from '../uuid.ts';

export type MessageBatch = {
    readonly messages: readonly Message[],
}

export type Message = Pick<QueueMessage, 'id' | 'body' | 'timestamp' | 'ack' | 'retry'>;

export async function processRedirectsBatch({ batch, rpcClient, consumerStart, colo, source }: { batch: MessageBatch, rpcClient: RpcClient, consumerStart: number, colo: string | undefined, source: string }) {
    const batchUuid = generateUuid();
    const rawRedirectsByMessageId: Record<string, { rawRedirects: RawRedirect[], timestamp: string }> = {};
    for (const msg of batch.messages) {
        const { body, id, timestamp } = msg;
        const rawRedirects = body as RawRedirect[];
        rawRedirectsByMessageId[id] = { rawRedirects, timestamp: timestamp.toISOString() };
    }
    const response = await rpcClient.logRawRedirectsBatch({ rawRedirectsByMessageId, rpcSentTime: new Date().toISOString() }, DoNames.hitsServer);
    const { processedMessageIds, colo: doColo, rpcSentTime, rpcReceivedTime, minTimestamp, medTimestamp, maxTimestamp, messageCount, redirectCount, putCount, evictedCount, newUrlCount, times: { packRawRedirects, saveAttNums, ensureMinuteFileLoaded, saveMinuteFile, saveIndexRecords, sendNotification } } = response;
    const messageIds = new Set(processedMessageIds);
    let ackCount = 0;
    let retryCount = 0;
    for (const msg of batch.messages) {
        if (messageIds.has(msg.id)) {
            msg.ack();
            ackCount++;
        } else {
            msg.retry();
            retryCount++;
        }
    }
    const consumerStartTime = new Date(consumerStart).toISOString();
    const consumerTime = Date.now() - consumerStart;
    const doubles: number[] = [ messageCount, redirectCount, putCount, evictedCount, ackCount, retryCount, newUrlCount ];
    const times: number[] = [ consumerTime, packRawRedirects, saveAttNums, ensureMinuteFileLoaded, saveMinuteFile, saveIndexRecords, sendNotification ];
    writeTraceEvent({ kind: 'hits-batch',
        strings: [ '', batchUuid, colo ?? '', doColo, rpcSentTime, rpcReceivedTime, minTimestamp ?? '', medTimestamp ?? '', maxTimestamp ?? '', consumerStartTime, source ],
        doubles: [ ...doubles, ...Array(20 - doubles.length - times.length).fill(0), ...times.reverse() ],
    });
    return { response, consumerTime, ackCount, retryCount };
}
