import { R2Bucket, R2ListOptions, R2MultipartUpload, R2UploadedPart, R2GetOptions, R2Object, R2ObjectBody } from '../deps.ts';
import { executeWithRetries } from '../sleep.ts';
import { Blobs, ListOpts, ListBlobsResponse, Multiput, GetOpts } from './blobs.ts';

export class R2BucketBlobs implements Blobs {
    private readonly bucket: R2Bucket;
    private readonly prefix: string;
    private readonly readonly?: boolean;

    constructor({ bucket, prefix, readonly }: { bucket: R2Bucket, prefix: string, readonly?: boolean }) {
        this.bucket = bucket;
        this.prefix = prefix;
        this.readonly = readonly;
    }

    async put(key: string, body: string | ReadableStream<Uint8Array> | ArrayBuffer): Promise<{ etag: string }> {
        const { bucket, prefix, readonly } = this;
        if (readonly) throw new Error(`Bucket is readonly!`);

        if (body instanceof ReadableStream) {
            const { etag } = await bucket.put(prefix + key, body);
            return { etag };
        } else {
            const { etag } = await r2(() => bucket.put(prefix + key, body));
            return { etag };
        }
    }

    get(key: string, as: 'stream-and-meta', opts?: GetOpts): Promise<{ stream: ReadableStream<Uint8Array>, etag: string } | undefined>;
    get(key: string, as: 'stream', opts?: GetOpts): Promise<ReadableStream<Uint8Array> | undefined>;
    get(key: string, as: 'buffer', opts?: GetOpts): Promise<ArrayBuffer | undefined>;
    get(key: string, as: 'text-and-meta', opts?: GetOpts): Promise<{ text: string, etag: string } | undefined>;
    get(key: string, as: 'text', opts?: GetOpts): Promise<string | undefined>;
    get(key: string, as: 'json', opts?: GetOpts): Promise<unknown | undefined>;
    async get(key: string, as: 'stream-and-meta' | 'stream' | 'buffer' | 'text' | 'text-and-meta' | 'json', opts: GetOpts = {}): Promise<{ stream: ReadableStream<Uint8Array>, etag: string } | ReadableStream<Uint8Array> | ArrayBuffer | { text: string, etag: string } | string | unknown | undefined> {
        const { bucket, prefix } = this;
        const { ifMatch } = opts;
        const options: R2GetOptions = ifMatch ? { onlyIf: { etagMatches: ifMatch }} : {};
        const obj = await r2(() => bucket.get(prefix + key, options));
        if (!obj) return undefined;
        if (!isR2ObjectBody(obj)) throw new Error(`No response body!`);
        const { etag } = obj;
        if (as === 'stream-and-meta') return { stream: obj.body, etag };
        if (as === 'stream') return obj.body;
        if (as === 'buffer') return await obj.arrayBuffer();
        if (as === 'text-and-meta') return { text: await obj.text(), etag };
        if (as === 'text') return await obj.text();
        if (as === 'json') return await obj.json();
        throw new Error(`Unsupported 'as' value: ${as}`);
    }

    async head(key: string): Promise<{ etag: string } | undefined> {
        const { bucket, prefix } = this;
        const obj = await r2(() => bucket.head(prefix + key));
        if (!obj) return undefined;
        const { etag } = obj;
        if (typeof etag !== 'string') throw new Error(`R2 head response had no etag for: ${key}`);
        return { etag };
    }

    async delete(key: string): Promise<void> {
        const { bucket, prefix, readonly } = this;
        if (readonly) throw new Error(`Bucket is readonly!`);

        await r2(() => bucket.delete(prefix + key));
    }

    async has(key: string): Promise<boolean> {
        const { bucket, prefix } = this;
        const obj = await r2(() => bucket.head(prefix + key));
        return !!obj;
    }
    
    async list(opts: ListOpts = {}): Promise<ListBlobsResponse> {
        const { bucket, prefix } = this;
        const { keyPrefix, afterKey } = opts;
        let listOpts: R2ListOptions = { prefix };
        if (typeof keyPrefix === 'string') listOpts = { ...listOpts, prefix: prefix + keyPrefix };
        if (typeof afterKey === 'string') listOpts = { ...listOpts, startAfter: prefix + afterKey };
        const res = await r2(() => bucket.list(listOpts));
        const prefixLength = prefix.length;
        const keys: string[] = [];
        for (const { key } of res.objects) {
            if (!key.startsWith(prefix)) throw new Error(`Unexpected key: ${key}`);
            keys.push(key.substring(prefixLength));
        }
        return { keys };
    }

    async startMultiput(key: string): Promise<Multiput> {
        const { bucket, prefix, readonly } = this;
        if (readonly) throw new Error(`Bucket is readonly!`);

        const upload = await r2(() => bucket.createMultipartUpload(prefix + key));
        return new R2Multiput(upload);
    }

}

//

class R2Multiput implements Multiput {
    private readonly upload: R2MultipartUpload;

    private readonly parts: R2UploadedPart[] = [];
    private readonly debug: string[] = [];

    constructor(upload: R2MultipartUpload) {
        this.debug.push(`new R2Multiput(${JSON.stringify(upload)})`);
        this.upload = upload;
    }

    async putPart(body: ReadableStream<Uint8Array> | ArrayBuffer | string): Promise<{ etag: string }> {
        const { upload, parts } = this;
        const partNum = parts.length + 1;
        const part = (body instanceof ReadableStream) ? await upload.uploadPart(partNum, body) : await r2(() => upload.uploadPart(partNum, body));
        this.debug.push(`putPart(${JSON.stringify({ ...part, inputPartNum: partNum })})`);
        parts.push(part);
        const { etag } = part;
        return { etag };
    }

    async complete(): Promise<{ parts: number, etag: string }> {
        const { upload, parts } = this;
        this.debug.push(`complete(${JSON.stringify(parts)})`);
        let attempts = 0;
        try {
            const { etag } = await r2(() => { attempts++; return upload.complete(parts); });
            return { parts: parts.length, etag };
        } catch (e) {
            throw new Error(`attempts:${attempts}, ${this.debug.join(', ')} e=${e.stack || e}`);
        }
    }

    async abort(): Promise<void> {
        const { upload } = this;
        await upload.abort();
    }

}

export function isRetryableErrorFromR2(e: Error): boolean {
    const error = `${e.stack || e}`;
    if (error.includes('(10001)')) return true; // Error: get: We encountered an internal error. Please try again. (10001)
    if (error.includes('(10048)')) return true; // Error: completeMultipartUpload: There was a problem with the multipart upload. (10048)
    if (error.includes('(10054)')) return true; // Error: get: Client Disconnect (10054)
    if (error.includes('(os error 54)')) return true; // (local) TypeError: error sending request for url (https://asdf.r2.cloudflarestorage.com/asdf): connection error: Connection reset by peer (os error 54)
    return false;
}

//

async function r2<T>(fn: () => Promise<T>): Promise<T> {
    return await executeWithRetries(fn, { tag: 'R2BucketBlobs', isRetryable: isRetryableErrorFromR2, maxRetries: 5 });
}

function isR2ObjectBody(obj: R2Object | R2ObjectBody): obj is R2ObjectBody {
    return 'body' in obj;
}
