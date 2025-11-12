import { tryParseUrl } from './check.ts';

export function tryCleanUrl(url: string): string | undefined {
    try {
        return cleanUrl(url);
    } catch {
        // noop
    }
}

export function cleanUrl(url: string): string {
    if (typeof url !== 'string') throw new Error(`Bad url: ${JSON.stringify(url)}`);
    // only basic canonicalization like scheme, hostname, redundant port, anchor removal
    const m = /^(https?):\/\/([^\/:?#]+)(:\d+)?(\/.*?)?(#.*?)?$/i.exec(url.trim());
    if (!m) throw new Error(`Bad url: ${url}`);
    const [ _, scheme, hostname, port, pathAndQuery, _anchor ] = m;
    const schemeLower = scheme.toLowerCase();
    const hostnameLower = hostname.toLowerCase();
    const portPart = typeof port === 'string' && ((schemeLower === 'http' && port !== ':80') || (schemeLower === 'https' && port !== ':443')) ? port : '';
    return `${schemeLower}://${hostnameLower}${portPart}${pathAndQuery ?? ''}`;
}

export function tryComputeMatchUrl(url: string, opts: { queryless?: boolean } = {}): string | undefined {
    try {
        return computeMatchUrl(url, opts);
    } catch {
        // noop
    }
}

export function computeMatchUrl(url: string, opts: { queryless?: boolean } = {}): string {
    // a matchurl is a lowercased clean url without the protocol or trailing slashes
    const { queryless = false } = opts;
    let rt = cleanUrl(url);
    if (queryless) {
        const i = rt.indexOf('?');
        if (i > -1) {
            rt = rt.substring(0, i);
        }
    }
    const hasQuery = rt.includes('?');
    if (!hasQuery) {
        while (rt.endsWith('/')) {
            rt = rt.substring(0, rt.length - 1);
        }
    }
    rt = rt.toLowerCase();
    if (hasQuery) rt = rt.replaceAll('&amp;', '&');
    const m = /^https?:\/\/(.+?)$/.exec(rt);
    if (!m) throw new Error(`Unable to compute match url for: ${url}`);
    return m[1];
}

export function tryComputeIncomingUrl(url: string): string | undefined {
    // "https://example.com/path/to/a file.mp3" -> https://example.com/path/to/a%20file.mp3
    const u = tryParseUrl(url);
    return u?.toString();
}
