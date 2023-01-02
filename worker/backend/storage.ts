import { DurableObjectStorageListOptions } from '../deps.ts';

export function computeListOpts(prefix: string, parameters: Record<string, string> = {}): DurableObjectStorageListOptions {
    const { limit, start, startAfter, end, reverse, prefix: prefixParam } = parameters;
    let rt: DurableObjectStorageListOptions = { prefix: `${prefix}${prefixParam ?? ''}` };
    if (typeof limit === 'string') rt = { ...rt, limit: parseInt(limit) };
    if (typeof start === 'string') rt = { ...rt, start: `${prefix}${start}` };
    if (typeof startAfter === 'string') rt = { ...rt, startAfter: `${prefix}${startAfter}` };
    if (typeof end === 'string') rt = { ...rt, end: `${prefix}${end}` };
    if (reverse === 'true' || reverse === 'false') rt = { ...rt, reverse: reverse === 'true' };
    return rt;
}
