
export function hasOp3Reference(url: string): boolean {
    return typeof url === 'string' && url.toLowerCase().includes('op3.dev/e');
}

export async function hasOp3InRedirectChain(url: string, { userAgent }: { userAgent: string }): Promise<boolean | undefined> {
    try {
        const records = await fetchWithRedirects(url, { method: 'HEAD', userAgent, stopWhenLocationMatches: hasOp3Reference });
        const last = records.at(-1);
        return last && hasOp3Reference(new Headers(last.responseHeaders).get('location') ?? '')
    } catch (e) {
        console.warn(`hasOp3InRedirectChain: Error starting from ${url}: ${(e as Error).stack || e}`);
    }
}

export async function fetchOp3RedirectUrls(url: string, { userAgent }: { userAgent: string }): Promise<{ redirectUrls: string[], responseHeaders?: [string, string][] }> {
    const records = await fetchWithRedirects(url, { method: 'HEAD', userAgent, stopWhenLocationMatches: hasOp3Reference });
    const last = records.at(-1);
    const location = last ? new Headers(last.responseHeaders).get('location') ?? undefined : undefined;
    const redirectUrls = location && hasOp3Reference(location) ? [ location ] : [ ];
    return { redirectUrls, responseHeaders: last?.responseHeaders };
}

export async function fetchWithRedirects(url: string, { method, userAgent, stopWhenLocationMatches }: { method?: string, userAgent: string, stopWhenLocationMatches?: (location: string) => boolean }): Promise<RequestResponse[]> {
    const rt: RequestResponse[] = [];
    let requestUrl = url;
    const requestUrls = new Set<string>();
    while (true) {
        const requestTime = Date.now();
        requestUrls.add(requestUrl);
        console.log(`fetchWithRedirects: ${method} ${url}`);
        const response = await fetch(requestUrl, { method, headers: { 'user-agent': userAgent }, redirect: 'manual' });
        const responseTime = Date.now();
        const responseStatus = response.status;
        const responseHeaders = [...response.headers];
        rt.push({ requestUrl, responseStatus, responseHeaders, requestTime, responseTime });
        if (![301, 302, 303, 307, 308].includes(responseStatus)) return rt;
        let location = (response.headers.get('location') || '').trim();
        if (location === '') return rt;
        if (location.startsWith('/')) {
            location = new URL(requestUrl).origin + location;
        }
        if (!/^https?:\/\/.+?$/.test(location)) return rt;
        if (requestUrls.has(location)) return rt;
        if (requestUrls.size >= 10) return rt;
        if (stopWhenLocationMatches && stopWhenLocationMatches(location)) return rt;
        requestUrl = location;
    }
}

export function isRedirectFetchingRequired({ generator, enclosureUrl }: { generator: string | undefined, enclosureUrl: string | undefined }): boolean {
    return /castopod/i.test(generator ?? '') // e.g. Castopod - https://castopod.org/
        || /\/s\.gum\.fm\//.test(enclosureUrl ?? '') // https://s.gum.fm/s-123123213/pdst.fm/e/traffic.omny.fm/d/clips/123123123/audio.mp3?amp;in_playlist=123123123123
        || /transistor\.fm/i.test(generator ?? '') // Transistor (https://transistor.fm)
        || /\/dgt\.fm\//.test(enclosureUrl ?? '') // https://dgt.fm/703.mp3 - https://digitalia.fm/feeds/digitalia.xml
        ;
}

//

export interface RequestResponse {
    readonly requestUrl: string;
    readonly responseStatus: number;
    readonly responseHeaders: [string, string][];
    readonly requestTime: number;
    readonly responseTime: number;
}
