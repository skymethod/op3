import { executeWithRetries } from './sleep.ts';

export interface Baselime {
    sendEvents(events: BaselimeEvent[]): void;
}

export interface BaselimeEvent {
    readonly message?: string;
    readonly error?: string;
    readonly level?: string;
    readonly requestId: string;
    readonly service: string;
    readonly namespace: string;
    readonly duration?: number;
    readonly timestamp?: number;
    readonly data?: Record<string, unknown>;
}

export function makeBaselimeFromWorkerContext(context: { waitUntil(promise: Promise<unknown>): void }, { baselimeEventsUrl, baselimeApiKey }: { baselimeEventsUrl: string, baselimeApiKey: string }): Baselime {
    return {
        sendEvents: events => {
            context.waitUntil(executeWithRetries(async () => {
                const res = await fetch(baselimeEventsUrl, { method: 'POST', headers: { 'x-api-key': baselimeApiKey, 'content-type': 'application/json' }, body: JSON.stringify(events) });
                if (res.status >= 500 && res.status < 600) throw new Error(`5xx error: ${res.status}`);
            }, { tag: 'send-baselime-events', maxRetries: 3, isRetryable: e => {
                const msg = `${(e as Error).stack || e}`;
                if (msg.includes('5xx error:')) return true;
                return false;
            } }));
        }
    }
}
