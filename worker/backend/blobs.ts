import { R2Bucket, R2ListOptions } from '../deps.ts';

export interface Blobs {
    put(key: string, body: ReadableStream<Uint8Array> | ArrayBuffer | string): Promise<void>;
    get(key: string, as: 'stream'): Promise<ReadableStream<Uint8Array> | undefined>;
    get(key: string, as: 'buffer'): Promise<ArrayBuffer | undefined>;
    get(key: string, as: 'text'): Promise<string | undefined>;
    delete(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
    list(opts?: ListOpts): Promise<ListBlobsResponse>
}

export type ListOpts = { keyPrefix?: string, afterKey?: string };

export interface ListBlobsResponse {
    readonly keys: readonly string[];
}

export class R2BucketBlobs implements Blobs {
    private readonly bucket: R2Bucket;
    private readonly prefix: string;

    constructor(bucket: R2Bucket, prefix: string) {
        this.bucket = bucket;
        this.prefix = prefix;
    }

    async put(key: string, body: string | ReadableStream<Uint8Array> | ArrayBuffer): Promise<void> {
        const { bucket, prefix } = this;
        await bucket.put(prefix + key, body);
    }

    get(key: string, as: 'stream'): Promise<ReadableStream<Uint8Array> | undefined>;
    get(key: string, as: 'buffer'): Promise<ArrayBuffer | undefined>;
    get(key: string, as: 'text'): Promise<string | undefined>;
    async get(key: string, as: 'stream' | 'buffer' | 'text'): Promise<ReadableStream<Uint8Array> | ArrayBuffer | string | undefined> {
        const { bucket, prefix } = this;
        const obj = await bucket.get(prefix + key);
        if (!obj) return undefined;
        if (as === 'stream') return obj.body;
        if (as === 'buffer') return await obj.arrayBuffer();
        if (as === 'text') return await obj.text();
        throw new Error(`Unsupported 'as' value: ${as}`);
    }

    async delete(key: string): Promise<void> {
        const { bucket, prefix } = this;
        await bucket.delete(prefix + key);
    }

    async has(key: string): Promise<boolean> {
        const { bucket, prefix } = this;
        const obj = await bucket.head(prefix + key);
        return !!obj;
    }
    
    async list(opts: ListOpts = {}): Promise<ListBlobsResponse> {
        const { bucket, prefix } = this;
        const { keyPrefix, afterKey } = opts;
        let listOpts: R2ListOptions & { startAfter?: string } = { prefix };
        if (typeof keyPrefix === 'string') listOpts = { ...listOpts, prefix: prefix + keyPrefix };
        if (typeof afterKey === 'string') listOpts = { ...listOpts, startAfter: prefix + afterKey };
        const res = await bucket.list(listOpts);
        const prefixLength = prefix.length;
        const keys: string[] = [];
        for (const { key } of res.objects) {
            if (!key.startsWith(prefix)) throw new Error(`Unexpected key: ${key}`);
            keys.push(key.substring(prefixLength));
        }
        return { keys };
    }

}
