import { DurableObjectStorage, DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageValue } from '../deps.ts';

export function computeListOpts(prefix: string, parameters: Record<string, string> = {}): DurableObjectStorageListOptions & DurableObjectStorageReadOptions {
    const { limit, start, startAfter, end, reverse, prefix: prefixParam, allowConcurrency, noCache } = parameters;
    let rt: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = { prefix: `${prefix}${prefixParam ?? ''}` };
    if (typeof limit === 'string') rt = { ...rt, limit: parseInt(limit) };
    if (typeof start === 'string') rt = { ...rt, start: `${prefix}${start}` };
    if (typeof startAfter === 'string') rt = { ...rt, startAfter: `${prefix}${startAfter}` };
    if (typeof end === 'string') rt = { ...rt, end: `${prefix}${end}` };
    if (reverse === 'true' || reverse === 'false') rt = { ...rt, reverse: reverse === 'true' };
    if (allowConcurrency === 'true' || allowConcurrency === 'false') rt = { ...rt, allowConcurrency: allowConcurrency === 'true' };
    if (noCache === 'true' || noCache === 'false') rt = { ...rt, noCache: noCache === 'true' };
    return rt;
}

export async function queryStorage(storage: DurableObjectStorage, parameters: Record<string, string>): Promise<{ results: unknown[] }> {
    const map = await storage.list(computeListOpts('', parameters));
    const { values = 'true', types = 'false', sizes = 'false' } = parameters;
    const [ includeValues, includeTypes, includeSizes ] = [ values, types, sizes ].map(v => v === 'true');
    const encoder = new TextEncoder();
    const computeEstimatedSize = (val: DurableObjectStorageValue): number => {
        if (typeof val === 'number') return 8;
        if (typeof val === 'string') return encoder.encode(val).length;
        if (typeof val === 'object') return encoder.encode(JSON.stringify(val)).length;
        throw new Error(JSON.stringify({ type: typeof val }));
    }
    const results: unknown[] = [];
    for (const [ key, value ] of map) {
        const result: unknown[] = [ key ];
        if (includeValues) result.push(value);
        if (includeTypes) result.push(typeof value);
        if (includeSizes) result.push(computeEstimatedSize(value));
        results.push(result);
    }
    return { results };
}
