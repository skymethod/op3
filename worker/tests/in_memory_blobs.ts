import { Blobs, GetOpts, ListBlobsResponse, ListOpts, Multiput } from '../backend/blobs.ts';
import { Bytes } from '../deps.ts';

export class InMemoryBlobs implements Blobs {
    private readonly data = new Map<string, Record>();

    async put(key: string, body: string | ArrayBuffer | ReadableStream<Uint8Array>): Promise<{ etag: string }> {
        const arr = await toByteArray(body);
        const etag = await computeEtag(arr);
        this.data.set(key, { arr, etag });
        return { etag };
    }

    get(key: string, as: 'stream-and-meta', opts?: GetOpts): Promise<{ stream: ReadableStream<Uint8Array>, etag: string } | undefined>;
    get(key: string, as: 'stream', opts?: GetOpts): Promise<ReadableStream<Uint8Array> | undefined>;
    get(key: string, as: 'buffer', opts?: GetOpts): Promise<ArrayBuffer | undefined>;
    get(key: string, as: 'text-and-meta', opts?: GetOpts): Promise<{ text: string, etag: string } | undefined>;
    get(key: string, as: 'text', opts?: GetOpts): Promise<string | undefined>;
    get(key: string, as: 'json', opts?: GetOpts): Promise<unknown | undefined>;
    async get(key: string, as: 'stream-and-meta' | 'stream' | 'buffer' | 'text' | 'text-and-meta' | 'json', opts: GetOpts = {}): Promise<string | { text: string, etag: string } | ArrayBuffer | ReadableStream<Uint8Array> | { stream: ReadableStream<Uint8Array>, etag: string } | unknown | undefined> {
        await Promise.resolve();
        if (Object.keys(opts).length > 0) throw new Error(`Unsupported get opts: ${JSON.stringify(opts)}`);
        const record = this.data.get(key);
        if (record === undefined) return undefined;
        const { arr, etag } = record;
        if (as === 'stream') return new Blob([ arr ]).stream();
        if (as === 'stream-and-meta') return { stream: new Blob([ arr ]).stream(), etag };
        if (as === 'buffer') return arr.buffer;
        if (as === 'text-and-meta') return { text: new TextDecoder().decode(arr), etag };
        if (as === 'text') return new TextDecoder().decode(arr);
        if (as === 'json') return JSON.parse(new TextDecoder().decode(arr));
        
        throw new Error();
    }

    async head(key: string): Promise<{ etag: string } | undefined> {
        await Promise.resolve();
        const record = this.data.get(key);
        if (record === undefined) return undefined;
        const { etag } = record;
        return { etag };
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
            .filter(v => afterKey === undefined || v > afterKey)
            ;
        return { keys };
    }

    async startMultiput(key: string): Promise<Multiput> {
        await Promise.resolve();
        return new InMemoryMultiput(key, this.data);
    }

}

//

type Record = { arr: Uint8Array, etag: string };

class InMemoryMultiput implements Multiput {
    private readonly key: string;
    private readonly data: Map<string, Record>;

    private combined = Bytes.EMPTY;
    private parts = 0;
    private done = false;

    constructor(key: string, data: Map<string, Record>) {
        this.key = key;
        this.data = data;
    }

    async putPart(body: ReadableStream<Uint8Array> | ArrayBuffer | string): Promise<{ etag: string }> {
        if (this.done) throw new Error(`Already done!`);
        await Promise.resolve();
        if (this.done) throw new Error(`Already done!`);
        const arr = await toByteArray(body);
        const etag = await computeEtag(arr);
        this.combined = this.combined.concat(new Bytes(arr));
        this.parts++;
        return { etag };
    }

    async complete(): Promise<{ parts: number, etag: string }> {
        await Promise.resolve();
        if (this.done) throw new Error(`Already done!`);
        const { parts, key, combined } = this;
        if (parts === 0) throw new Error(`No parts!`);
        const arr = combined.array();
        const etag = await computeEtag(arr);
        this.data.set(key, { arr, etag });
        this.done = true;
        return { parts, etag };
    }

    async abort(): Promise<void> {
        await Promise.resolve();
        if (this.done) throw new Error(`Already done!`);
        this.done = true;
    }

}

//

async function toByteArray(body: string | ArrayBuffer | ReadableStream<Uint8Array>): Promise<Uint8Array> {
    return typeof body === 'string' ? new TextEncoder().encode(body)
        : body instanceof ArrayBuffer ? new Uint8Array(body)
        : new Uint8Array(await new Response(body).arrayBuffer())
}

async function computeEtag(arr: Uint8Array): Promise<string> {
    return (await new Bytes(arr).sha1()).hex();
}
