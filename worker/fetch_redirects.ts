
export function hasOp3Reference(url: string): boolean {
    return typeof url === 'string' && url.toLowerCase().includes('op3.dev/e');
}

export async function hasOp3InRedirectChain(url: string, { userAgent }: { userAgent: string }): Promise<boolean | undefined> {
    try {
        const records = await fetchWithRedirects(url, { method: 'HEAD', userAgent, stopWhenLocationMatches: hasOp3Reference });
        const last = records.at(-1);
        return last && hasOp3Reference(new Headers(last.responseHeaders).get('location') ?? '')
    } catch (e) {
        console.warn(`hasOp3InRedirectChain: Error starting from ${url}: ${e.stack || e}`);
    }
}

export async function fetchWithRedirects(url: string, { method, userAgent, stopWhenLocationMatches }: { method?: string, userAgent: string, stopWhenLocationMatches?: (location: string) => boolean }): Promise<RequestResponse[]> {
    const rt: RequestResponse[] = [];
    let requestUrl = url;
    const requestUrls = new Set<string>();
    while (true) {
        const requestTime = Date.now();
        requestUrls.add(requestUrl);
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
        if (requestUrls.has(requestUrl)) return rt;
        if (requestUrls.size >= 10) return rt;
        if (stopWhenLocationMatches && stopWhenLocationMatches(location)) return rt;
        requestUrl = location;
    }
}

//

export interface RequestResponse {
    readonly requestUrl: string;
    readonly responseStatus: number;
    readonly responseHeaders: [string, string][];
    readonly requestTime: number;
    readonly responseTime: number;
}
