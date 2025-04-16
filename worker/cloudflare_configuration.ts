import { Configuration } from './configuration.ts';
import { CfCache, KVNamespace } from './deps.ts';
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

export async function getCachedString(key: string, namespace: KVNamespace, cache: CfCache): Promise<string | undefined> {
    const cacheKey = `http://op3.com/_kvcache/${key}`; // must be a valid hostname, but never routable to avoid conflicts with worker fetch
    const res = await cache.match(cacheKey);
    if (res) return await res.text();
    const val = await executeWithRetries(async () => {
        const value = await namespace.get(key);
        return typeof value === 'string' ? value : undefined;
    }, { tag: 'cc.kv.get', maxRetries: 3, isRetryable });
    if (typeof val === 'string') {
        await cache.put(cacheKey, new Response(val));
    }
    return val;
}

//

function isRetryable(e: Error): boolean {
    const error = `${(e as Error).stack || e}`;
    if (error.includes('500 Internal Server Error')) return true; // Error: KV GET failed: 500 Internal Server Error
    if (error.includes('503 Service Temporarily Unavailable')) return true; // Error: KV GET failed: 503 Service Temporarily Unavailable
    if (error.includes('Network connection lost')) return true; // Error: Network connection lost.
    return false;
}
