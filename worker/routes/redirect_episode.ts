import { tryParseInt } from '../check.ts';

export function tryParseRedirectRequest(requestUrl: string): RedirectRequest | undefined {
    // parse path by hand instead of using URL.pathname, we need to be robust to any and all input
    const m = /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?\/e(,.*?)?\/\/?(https?:\/\/?)?(.*?)$/.exec(requestUrl);
    if (!m) return undefined;
    const [ _, _optPort, _optArgs, optPrefix, suffix ] = m;
    if (/^https?:\/\//.test(suffix)) return { kind: 'invalid' }; // /e/https://
    if (!isValidSuffix(suffix)) {
        if (suffix && suffix.startsWith('pg=') && requestUrl && requestUrl.includes('://op3.dev/e/pg=')) {
            // temporarily support found typo: https://op3.dev/e/pg=
            return tryParseRedirectRequest(requestUrl.replace('://op3.dev/e/pg=', '://op3.dev/e,pg='));
        }
        return { kind: 'invalid' };
    }
    let prefix = optPrefix ?? 'https://';
    if (!prefix.endsWith('//')) prefix += '/'; // /e/https:/
    const targetUrl = `${prefix}${suffix}`;
    return { kind: 'valid', targetUrl };
}

export function computeRedirectResponse(request: ValidRedirectRequest): Response {
    return new Response(undefined, {
        // Temporary redirect: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302
        status: 302,
        headers: {
            // ensure the redirect is never cached, we want to be notified of every request
            // even though the spec discourages user agents from caching these, it is not prohibited, 
            // and many CDNs like cloudflare will cache them for a short period of time
            'cache-control': 'private, no-cache',

            // specify the target of the redirect
            'location': request.targetUrl,

            // allow cors requests, we should not be the blocking link in the redirect chain
            'access-control-allow-origin': '*',
        }
    })
}

//

export type RedirectRequest = ValidRedirectRequest | InvalidRedirectRequest;

export interface ValidRedirectRequest {
    readonly kind: 'valid';
    readonly targetUrl: string;
}

export interface InvalidRedirectRequest {
    readonly kind: 'invalid';
}

//

function isValidSuffix(suffix: string): boolean {
    const slash = suffix.indexOf('/');
    if (slash < 0) return false;
    const path = suffix.substring(slash);
    if (path.length === 1) return false;
    const authority = suffix.substring(0, slash);
    const m = /^([a-zA-Z0-9.-]+)(:(\d+))?$/.exec(authority);
    if (!m) return false;
    const [ _, hostname, __, portStr ] = m;
    const port = tryParseInt(portStr);
    if (portStr !== undefined && (port === undefined || port === 0 || port > 65535)) return false;
    if (hostname.startsWith('.') || hostname.startsWith('-') || hostname.endsWith('-')) return false;
    if (hostname.includes('..')) return false;
    if (hostname === 'localhost') return false;
    return true;
}
