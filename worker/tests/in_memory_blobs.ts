import { Blobs, ListBlobsResponse, ListOpts } from '../backend/blobs.ts';

export class InMemoryBlobs implements Blobs {
    private readonly data = new Map<string, Uint8Array>();

    async put(key: string, body: string | ArrayBuffer | ReadableStream<Uint8Array>): Promise<void> {
        const arr = typeof body === 'string' ? new TextEncoder().encode(body)
            : body instanceof ArrayBuffer ? new Uint8Array(body)
            : new Uint8Array(await new Response(body).arrayBuffer())
        
        this.data.set(key, arr);
    }

    get(key: string, as: 'stream'): Promise<ReadableStream<Uint8Array> | undefined>;
    get(key: string, as: 'buffer'): Promise<ArrayBuffer | undefined>;
    get(key: string, as: 'text'): Promise<string | undefined>;
    async get(key: string, as: 'stream' | 'buffer' | 'text'): Promise<string | ArrayBuffer | ReadableStream<Uint8Array> | undefined> {
        await Promise.resolve();
        const arr = this.data.get(key);
        if (arr === undefined) return undefined;
        if (as === 'stream') return new Blob([ arr ]).stream();
        if (as === 'buffer') return arr.buffer;
        if (as === 'text') return new TextDecoder().decode(arr);
        
        throw new Error();
    }

    async delete(key: string): Promise<void> {
        await Promise.resolve();
        this.data.delete(key);
    }

    async has(key: string): Promise<boolean> {
        await Promise.resolve();
        return this.data.has(key);
    }

    async list(opts: ListOpts = {}): Promise<ListBlobsResponse> {
        await Promise.resolve();
        const { keyPrefix, afterKey } = opts;
        const keys = [...this.data.keys()]
            .sort()
            .filter(v => keyPrefix === undefined || v.startsWith(keyPrefix))
            .filter(v => afterKey === undefined || v.localeCompare(afterKey) > 0)
            ;
        return { keys };
    }

}
