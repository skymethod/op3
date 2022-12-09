
export interface Blobs {
    put(key: string, body: ReadableStream<Uint8Array> | ArrayBuffer | string): Promise<void>;
    get(key: string, as: 'stream'): Promise<ReadableStream<Uint8Array> | undefined>;
    get(key: string, as: 'buffer'): Promise<ArrayBuffer | undefined>;
    get(key: string, as: 'text'): Promise<string | undefined>;
    delete(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
    list(opts?: ListOpts): Promise<ListBlobsResponse>;
}

export type ListOpts = { keyPrefix?: string, afterKey?: string };

export interface ListBlobsResponse {
    readonly keys: readonly string[];
}
