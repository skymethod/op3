import { Configuration } from './configuration.ts';
import { KVNamespace } from './deps.ts';

export class CloudflareConfiguration implements Configuration {
    private readonly namespace: KVNamespace;

    constructor(namespace: KVNamespace) {
        this.namespace = namespace;
    }

    async get(name: string): Promise<string | undefined> {
        const value = await this.namespace.get(name);
        return typeof value === 'string' ? value : undefined;
    }

    async getObj(name: string): Promise<Record<string, unknown> | undefined> {
        const value = await this.namespace.get(name, { type: 'json' });
        return value ? value : undefined;
    }

}
