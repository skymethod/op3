import { Queue, QueuesContentType } from './deps.ts';
import { executeWithRetries } from './sleep.ts';

export async function sendWithRetries(queue: Queue, message: unknown, opts: { tag: string, maxRetries?: number, contentType?: QueuesContentType }) {
    const { tag, maxRetries = 3, contentType } = opts;
    await executeWithRetries(async () => {
        await queue.send(message, { contentType });
    }, { tag, maxRetries, isRetryable: e => {
        const error = `${e.stack || e}`;
        if (error.includes('Network connection lost')) return true; // Error: Network connection lost.
        if (error.includes('Internal Server Error')) return true; // Error: Queue send failed: Internal Server Error
        if (error.includes('Service Temporarily Unavailable')) return true; //  Error: Queue send failed: Service Temporarily Unavailable
        return false;
    }});
}
