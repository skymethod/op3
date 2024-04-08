import { Configuration } from './configuration.ts';
import { KVNamespace } from './deps.ts';
import { executeWithRetries } from './sleep.ts';

export class CloudflareConfiguration implements Configuration {
    private readonly namespace: KVNamespace;

    constructor(namespace: KVNamespace) {
        this.namespace = namespace;
    }

    async get(name: string): Promise<string | undefined> {
        return await executeWithRetries(async () => {
            const value = await this.namespace.get(name);
            return typeof value === 'string' ? value : undefined;
        }, { tag: 'cc.kv.get', maxRetries: 3, isRetryable });
    }

    async getObj(name: string): Promise<Record<string, unknown> | undefined> {
        return await executeWithRetries(async () => {
            const value = await this.namespace.get(name, { type: 'json' });
            return value ? value : undefined;
        }, { tag: 'cc.kv.get-obj', maxRetries: 3, isRetryable });
    }

}

//

function isRetryable(e: Error): boolean {
    const error = `${e.stack || e}`;
    if (error.includes('500 Internal Server Error')) return true; // Error: KV GET failed: 500 Internal Server Error
    if (error.includes('503 Service Temporarily Unavailable')) return true; // Error: KV GET failed: 503 Service Temporarily Unavailable
    if (error.includes('Network connection lost')) return true; // Error: Network connection lost.
    return false;
}
