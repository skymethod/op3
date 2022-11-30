
export type ByteRange = { start: number, end?: number } | { suffix: number };

export function tryParseRangeHeader(range: string): ByteRange[] | undefined {
    try {
        return parseRangeHeader(range);
    } catch {
        // noop
    }
}

export function parseRangeHeader(range: string): ByteRange[] {
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range
    // https://httpwg.org/specs/rfc9110.html#field.range
    let m = /^bytes=((\d+-\d*|-\d+)(\s*,\s*(\d+-\d*|-\d+))*)$/.exec(range);
    if (!m) throw new Error(`Unsupported range: ${range}`);
    const rt: ByteRange[] = [];
    for (const spec of m[1].split(',').map(v => v.trim())) {
        m = /^(\d+)?-(\d+)?$/.exec(spec);
        if (!m) throw new Error(`Unsupported range: ${range}`);
        const [ _, startStr, endStr ] = m;
        console.log({ spec, startStr, endStr });
        const [ start, end ] = [ startStr, endStr ].map(v => typeof v === 'string' ? parseInt(v) : undefined);
        if (typeof start === 'number') {
            if (typeof end === 'number') {
                if (end < start) throw new Error(`Unsupported range: ${range}`);
                rt.push({ start, end });
            } else {
                rt.push({ start });
            }
        } else if (typeof end === 'number') {
            if (end < 1) throw new Error(`Unsupported range: ${range}`);
            rt.push({ suffix: end });
        }
    }
    if (rt.length === 0) throw new Error(`Unsupported range: ${range}`);
    return rt;
}

export function estimateByteRangeSize(byteRange: ByteRange): number {
    return 'suffix' in byteRange ? byteRange.suffix
        : typeof byteRange.end === 'number' ? (byteRange.end + 1 - byteRange.start)
        : Number.MAX_SAFE_INTEGER;
}
