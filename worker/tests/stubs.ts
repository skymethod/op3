import { CfCache, CfCacheOptions, KVNamespace, KVPutOptions, KVGetOptions, KVValueAndMetadata, KVListCompleteResult, KVListIncompleteResult, KVListOptions } from '../deps.ts';

export class StubKVNamespace implements KVNamespace {
    put(key: string, value: string | ReadableStream | ArrayBuffer, opts?: KVPutOptions): Promise<void> {
        throw new Error(`StubKVNamespace: put(${JSON.stringify({ key, value, opts })}) not implemented`);
    }

    get(key: string, opts?: KVGetOptions | { type: 'text' }): Promise<string | null>;
    get(key: string, opts: KVGetOptions | { type: 'json' }): Promise<Record<string, unknown> | null>;
    get(key: string, opts: KVGetOptions | { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
    get(key: string, opts: KVGetOptions | { type: 'stream' }): Promise<ReadableStream | null>;
    // deno-lint-ignore no-explicit-any
    get(key: unknown, opts: unknown): Promise<any> {
        throw new Error(`StubKVNamespace: get(${JSON.stringify({ key, opts })}) not implemented`);
    }

    getWithMetadata(key: string, opts?: KVGetOptions | { type: 'text' }): Promise<KVValueAndMetadata<string> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'json' }): Promise<KVValueAndMetadata<Record<string, unknown>> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'arrayBuffer' }): Promise<KVValueAndMetadata<ArrayBuffer> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'stream' }): Promise<KVValueAndMetadata<ReadableStream> | null>;
    // deno-lint-ignore no-explicit-any
    getWithMetadata(key: unknown, opts: unknown): Promise<any> {
        throw new Error(`StubKVNamespace: getWithMetadata(${JSON.stringify({ key, opts })}) not implemented`);
    }

    delete(key: string): Promise<void> {
        throw new Error(`StubKVNamespace: delete(${JSON.stringify({ key })}) not implemented`);
    }

    list(opts?: KVListOptions): Promise<KVListCompleteResult | KVListIncompleteResult> {
        throw new Error(`StubKVNamespace: list(${JSON.stringify({ opts })}) not implemented`);
    }
}

export class StubCfCache implements CfCache {
    put(request: string | Request, response: Response): Promise<undefined> {
        throw new Error(`StubCfCache: put(${JSON.stringify({ request, response })}) not implemented`);
    }

    match(request: string | Request, opts?: CfCacheOptions): Promise<Response | undefined> {
        throw new Error(`StubCfCache: match(${JSON.stringify({ request, opts })}) not implemented`);
    }

    delete(request: string | Request, opts?: CfCacheOptions): Promise<boolean> {
        throw new Error(`StubCfCache: delete(${JSON.stringify({ request, opts })}) not implemented`);
    }
}
