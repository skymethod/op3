// minimal deps to facilitate sharing across projects
import { Bytes } from 'https://raw.githubusercontent.com/skymethod/denoflare/70cf8b36ea1b3d7f43c892d31cc96cfcdbc075d8/common/bytes.ts';
import type { GetObjectOpts, HeadObjectOpts } from 'https://raw.githubusercontent.com/skymethod/denoflare/70cf8b36ea1b3d7f43c892d31cc96cfcdbc075d8/common/r2/get_head_object.ts';
import type { PutObjectOpts } from 'https://raw.githubusercontent.com/skymethod/denoflare/70cf8b36ea1b3d7f43c892d31cc96cfcdbc075d8/common/r2/put_object.ts';
import type { AwsCallContext, CompletedPart } from 'https://raw.githubusercontent.com/skymethod/denoflare/70cf8b36ea1b3d7f43c892d31cc96cfcdbc075d8/common/r2/r2.ts';
import type { ListBucketResult, ListObjectsOpts } from 'https://raw.githubusercontent.com/skymethod/denoflare/70cf8b36ea1b3d7f43c892d31cc96cfcdbc075d8/common/r2/list_objects_v2.ts';
import type { UploadPartOpts } from 'https://raw.githubusercontent.com/skymethod/denoflare/70cf8b36ea1b3d7f43c892d31cc96cfcdbc075d8/common/r2/upload_part.ts';
import { abortMultipartUpload, completeMultipartUpload, createMultipartUpload, deleteObject, getObject, headObject, listObjectsV2, putObject, uploadPart } from 'https://raw.githubusercontent.com/skymethod/denoflare/70cf8b36ea1b3d7f43c892d31cc96cfcdbc075d8/common/r2/r2.ts';
import { checkMatches } from '../check.ts';
import { executeWithRetries } from '../sleep.ts';
import { Blobs, ListBlobsResponse, ListOpts, Multiput } from './blobs.ts';

export type R2ApiBlobsOpts = { context: AwsCallContext, origin: string, region: string, bucket: string, prefix: string };

export class R2ApiBlobs implements Blobs {
    readonly opts: R2ApiBlobsOpts;

    public constructor(opts: R2ApiBlobsOpts) {
        this.opts = opts;
    }

    async list(opts: ListOpts = {}): Promise<ListBlobsResponse> {
        const { keyPrefix, afterKey } = opts;
        const { bucket, origin, region, context } = this.opts;
        const prefix = keyPrefix ? `${this.opts.prefix}${keyPrefix}` : this.opts.prefix;
        const startAfter = afterKey ? `${this.opts.prefix}${afterKey}` : undefined;
        const keys: string[] = [];
        let continuationToken: string | undefined;
        while (true) {
            const { isTruncated, contents, continuationToken: token } = await listObjectsV2WithRetries({ bucket, origin, region, prefix, startAfter, continuationToken }, context, 'r2-api-blobs-list');
            keys.push(...contents.map(v => v.key.substring(this.opts.prefix.length)));
            if (!isTruncated) return { keys };
            continuationToken = token;
        }
    }

    get(key: string, as: 'stream-and-meta'): Promise<{ stream: ReadableStream<Uint8Array>, etag: string } | undefined>;
    get(key: string, as: 'stream'): Promise<ReadableStream<Uint8Array> | undefined>;
    get(key: string, as: 'buffer'): Promise<ArrayBuffer | undefined>;
    get(key: string, as: 'text-and-meta'): Promise<{ text: string, etag: string } | undefined>;
    get(key: string, as: 'text'): Promise<string | undefined>;
    get(key: string, as: 'json'): Promise<unknown | undefined>;
    async get(key: string, as: string): Promise<unknown> {
        const { bucket, origin, region, context } = this.opts;
        const res = await getObjectWithRetries({ bucket, key: `${this.opts.prefix}${key}`, origin, region }, context, 'r2-api-blobs-get');
        if (!res) return undefined;
        if (res.status !== 200) throw new Error(`Unexpected status: ${res.status}`);
        const etag = computeUnquotedEtag(res.headers);
        if (as === 'stream') return res.body;
        if (as === 'stream-and-meta')  return { stream: res.body, etag };
        if (as === 'text') return await res.text();
        if (as === 'text-and-meta') return { text: await res.text(), etag };
        if (as === 'buffer') return await res.arrayBuffer();
        if (as === 'json') return await res.json();
                  
        throw new Error();
    }

    async put(key: string, body: ReadableStream<Uint8Array> | ArrayBuffer | string): Promise<{ etag: string }> {
        const bytes = body instanceof ReadableStream ? await Bytes.ofStream(body)
            : typeof body === 'string' ? Bytes.ofUtf8(body)
            : new Bytes(new Uint8Array(body));
        const { bucket, origin, region, context } = this.opts;
        await putObjectWithRetries({ bucket, key: `${this.opts.prefix}${key}`, origin, region, body: bytes }, context, 'r2-api-blobs-put');
        const res = await headObjectWithRetries({ bucket, key: `${this.opts.prefix}${key}`, origin, region }, context, 'r2-api-blobs-put');
        if (!res) throw new Error();
        const etag = computeUnquotedEtag(res.headers);
        return { etag };
    }

    async head(key: string): Promise<{ etag: string } | undefined> {
        const { bucket, origin, region, context } = this.opts;
        const res = await headObject({ bucket, key: `${this.opts.prefix}${key}`, origin, region }, context);
        if (!res) return undefined;
        const etag = computeUnquotedEtag(res.headers);
        return etag ? { etag } : undefined;
    }

    async has(key: string): Promise<boolean> {
        return await this.head(key) !== undefined;
    }

    async delete(key: string): Promise<void> {
        const { bucket, origin, region, context } = this.opts;
        await deleteObject({ bucket, key: `${this.opts.prefix}${key}`, origin, region }, context);
    }

    async startMultiput(key: string): Promise<Multiput> {
        const { bucket, origin, region, context } = this.opts;
        key = `${this.opts.prefix}${key}`;

        const { uploadId } = await createMultipartUpload({ bucket, key, origin, region }, context);
        let partNumber = 0;
        const parts: CompletedPart[] = [];
        const rt: Multiput = {
            putPart: async b => {
                partNumber++;
                const type = b instanceof ReadableStream ? 'stream'
                    : typeof b === 'string' ? 'string'
                    : b instanceof Uint8Array ? 'uint8array'
                    : 'arraybuffer';
                console.log(`putPart ${type} ${partNumber} ${bucket}/${key}`);
                const body = b instanceof ReadableStream ? (await Bytes.ofStream(b))
                    : typeof b === 'string' ? b
                    : b instanceof Uint8Array ? new Bytes(b)
                    : new Bytes(new Uint8Array(b));
                // careful: S3/R2 returns quoted etags, but R2 binding does not
                const { etag: httpEtag } = await uploadPartWithRetries({ bucket, key, origin, region, uploadId, partNumber, body }, context, 'r2-api-blobs-upload-part');
                parts.push({ partNumber, etag: httpEtag });
                const etag = computeUnquotedEtag(httpEtag);
                return { etag };
            },
            complete: async () => {
                const { etag: httpEtag } = await completeMultipartUpload({ bucket, key, origin, region, uploadId, parts }, context);
                const etag = computeUnquotedEtag(httpEtag);
                return { etag, parts: parts.length };
            },
            abort: async () => {
                await abortMultipartUpload({ bucket, key, origin, region, uploadId }, context);
            },
        };
        return rt;
    }

}

//

function computeUnquotedEtag(headersOrHttpEtag: Headers | string) {
    const httpEtag = typeof headersOrHttpEtag === 'string' ? headersOrHttpEtag : (headersOrHttpEtag.get('etag') ?? undefined);
    if (httpEtag === undefined) throw new Error(`No http etag!`);
    return checkMatches('httpEtag', httpEtag, /^(W\/)?"([0-9a-f]+(-\d)?)"$/)[2];
}

function isRetryableR2(e: Error): boolean {
    const msg = `${e.stack || e}`;
    if (msg.includes('Unexpected status: 502')) return true;
    if (msg.includes('Unexpected status 502')) return true; // Error: Unexpected status 502, code=InternalError, message=We encountered an internal connectivity issue. Please try again.
    if (msg.includes('Unexpected status 500')) return true; // Error: Unexpected status 500, code=InternalError, message=We encountered an internal error. Please try again.
    if (msg.includes('Unexpected status 503')) return true; // Error: Unexpected status 503, code=ServiceUnavailable, message=Please look at https://www.cloudflarestatus.com for issues or contact customer support.
    if (msg.includes('connection closed before message completed')) return true; // TypeError: error sending request for url (https://asdf.asdf.r2.cloudflarestorage.com/asdf): connection closed before message completed
    if (msg.includes('Operation timed out')) return true; // TypeError: error sending request for url (https://asdf.asdf.r2.cloudflarestorage.com/asdf): connection error: Operation timed out (os error 60)
    if (msg.includes('tls handshake eof')) return true; // TypeError: error sending request for url (https://asdf.asdf.r2.cloudflarestorage.com/asdf): error trying to connect: tls handshake eof
    if (msg.includes('reset by peer')) return true; // TypeError: error sending request for url (https://asdf.asdf.r2.cloudflarestorage.com/asdf): connection error: Connection reset by peer (os error 54)
    if (msg.includes('dns error: failed to lookup address')) return true; // TypeError: error sending request for url (https://asdf.asdf.r2.cloudflarestorage.com/asdf): error trying to connect: dns error: failed to lookup address information: nodename nor servname provided, or not known
    if (msg.includes('Unexpected status 429') && msg.includes('Reduce your rate')) return true; // Error: Unexpected status 429, code=ServiceUnavailable, message=Reduce your rate of simultaneous reads on the same object.
    if (msg.includes('Unexpected status 500')) return true; // Error: Unexpected status 500, code=InternalError, message=We encountered an internal error. Please try again.
    if (msg.includes('Unexpected status 522')) return true; // Error: Unexpected status 522
    return false;
}

//

export async function putObjectWithRetries(opts: PutObjectOpts, context: AwsCallContext, tag: string): Promise<void> {
    if (opts.body instanceof ReadableStream) return await putObject(opts, context);
    return await executeWithRetries(() => putObject(opts, context), { tag, maxRetries: 3, isRetryable: isRetryableR2 });
}

export async function headObjectWithRetries(opts: HeadObjectOpts, context: AwsCallContext, tag: string): Promise<Response | undefined> {
    return await executeWithRetries(() => headObject(opts, context), { tag, maxRetries: 3, isRetryable: isRetryableR2 });
}

export async function getObjectWithRetries(opts: GetObjectOpts, context: AwsCallContext, tag: string): Promise<Response | undefined> {
    return await executeWithRetries(() => getObject(opts, context), { tag, maxRetries: 3, isRetryable: isRetryableR2 });
}

export async function listObjectsV2WithRetries(opts: ListObjectsOpts, context: AwsCallContext, tag: string): Promise<ListBucketResult> {
    return await executeWithRetries(() => listObjectsV2(opts, context), { tag, maxRetries: 3, isRetryable: isRetryableR2 });
}

export async function uploadPartWithRetries(opts: UploadPartOpts, context: AwsCallContext, tag: string): Promise<{ etag: string }> {
    if (opts.body instanceof ReadableStream) return await uploadPart(opts, context);
    return await executeWithRetries(() => uploadPart(opts, context), { tag, maxRetries: 3, isRetryable: isRetryableR2 });
}
