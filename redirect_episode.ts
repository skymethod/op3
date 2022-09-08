
export function tryParseRedirectRequest(requestUrl: string): RedirectRequest | undefined {
    // parse path by hand instead of using URL.pathname, we need to be robust to any and all input
    const m = /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?\/e\/(.*?)$/.exec(requestUrl);
    if (!m) return undefined;
    const targetUrl = `https://${m[2]}`;
    return { targetUrl };
}

export function computeRedirectResponse(request: RedirectRequest): Response {
    return new Response(undefined, {
        // Temporary redirect: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302
        status: 302,
        headers: {
            // ensure the redirect is never cached, we want to be notified of every request
            // even though the spec discourages user agents from caching these, it is not prohibited, 
            // and many CDNS like cloudflare will cache them for a short period of time
            'cache-control': 'private, no-cache',

            // specify the target of the redirect
            'location': request.targetUrl,
        }
    })
}

//

export interface RedirectRequest {
    readonly targetUrl: string;
}
