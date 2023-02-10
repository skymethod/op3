import { DurableObjectStorageListOptions, DurableObjectStorageReadOptions } from '../deps.ts';

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
