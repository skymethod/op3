
export function tryParseUlid(url: string): { url: string, ulid?: string } {
    const m = /^(.+?)([?&])_ulid=(.*?)(&.+?)?$/.exec(url);
    if (!m) return { url };
    const [ _, prefix, delim, ulidStr, suffix ] = m;
    const ulid = ulidStr === '' ? undefined : ulidStr;
    const url2 = delim === '&' ? `${prefix}${suffix === undefined ? '' : suffix }`
        : suffix === undefined ? prefix
        : `${prefix}?${suffix.substring(1)}`;
    return ulid !== undefined ? { ulid, url: url2 } : { url: url2 };
}
