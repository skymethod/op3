
export interface Blobs {
    put(key: string, body: ReadableStream<Uint8Array> | ArrayBuffer | string): Promise<{ etag: string }>;
    get(key: string, as: 'stream-and-meta', opts?: GetOpts): Promise<{ stream: ReadableStream<Uint8Array>, etag: string } | undefined>;
    get(key: string, as: 'stream', opts?: GetOpts): Promise<ReadableStream<Uint8Array> | undefined>;
    get(key: string, as: 'buffer', opts?: GetOpts): Promise<ArrayBuffer | undefined>;
    get(key: string, as: 'text-and-meta', opts?: GetOpts): Promise<{ text: string, etag: string } | undefined>;
    get(key: string, as: 'text', opts?: GetOpts): Promise<string | undefined>;
    get(key: string, as: 'json', opts?: GetOpts): Promise<unknown | undefined>;
    delete(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
    list(opts?: ListOpts): Promise<ListBlobsResponse>;
    listWithMetadata(opts?: ListOpts): Promise<ListBlobsWithMetadataResponse>;
    startMultiput(key: string): Promise<Multiput>;
    head(key: string): Promise<{ etag: string } | undefined>;
}

export type ListOpts = { keyPrefix?: string, afterKey?: string, limit?: number };
export type GetOpts = { ifMatch?: string };

export interface ListBlobsResponse {
    readonly keys: readonly string[];
}

export interface ListBlobsWithMetadataResponse {
    readonly entries: readonly { key: string, size: number, etag?: string }[];
}

export interface Multiput {
    putPart(body: ReadableStream<Uint8Array> | ArrayBuffer | string): Promise<{ etag: string }>;
    complete(): Promise<{ parts: number, etag: string }>;
    abort(): Promise<void>;
}
