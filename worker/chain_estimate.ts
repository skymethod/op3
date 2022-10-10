import { tryParseInt, tryParseUrl } from './check.ts';

export function computeChainDestinationUrl(url: string): string | undefined {
    const estimate = computeChainEstimate(url);
    const last = estimate.at(-1);
    return last && last.kind === 'destination' ? last.url : undefined;
}

export function computeChainDestinationHostname(url: string): string | undefined {
    const destinationUrl = computeChainDestinationUrl(url);
    return destinationUrl ? tryParseUrl(destinationUrl)?.hostname : undefined;
}

export function computeChainEstimate(url: string): ChainEstimate {

    url = normalizeOrigin(url);

    // https://op3.dev/e/(https?://)?
    // no http support (.dev TLD on HSTS preload list), but clients (browsers) redirect anyway?
    let m = /^https?:\/\/(ci\.|staging\.)?\op3\.dev(:443|:80)?\/e\/(.+?)$/.exec(url);
    if (m) {
        const [ _, _subdomain, _port, suffix ] = m;
        m = /^((https?):\/\/?).*?$/i.exec(suffix);
        const targetUrl = m ? `${m[2].toLowerCase()}://${suffix.substring(m[1].length)}` : `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'op3', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://dts.podtrac.com/redirect.mp3/
    // http redirects to https for registered feeds
    // need to find an http example
    m = /^https?:\/\/dts\.podtrac\.com\/redirect\.mp3\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'podtrac', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pdst.fm/e/
    // http redirects to target http
    m = /^(https?):\/\/pdst\.fm\/e\/(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, suffix ] = m;
        const targetUrl = `${scheme}://${suffix}`;
        return [ { kind: 'prefix', prefix: 'podsights', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://chrt.fm/track/CHRT123/
    // also chtbl.com/track/12345
    // http redirects to target http
    m = /^(https?):\/\/(chrt\.fm|chtbl\.com)\/track\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, _domain, suffix ] = m;
        const targetUrl = `${scheme}://${suffix}`;
        return [ { kind: 'prefix', prefix: 'chartable', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pfx.veritonicmetrics.com/vt123/
    // no http support
    m = /^https:\/\/pfx\.veritonicmetrics\.com\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'veritonic', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://arttrk.com/p/ARTS1/
    // http redirects to target https
    m = /^https?:\/\/arttrk\.com\/p\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'artsai', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pdcn.co/e/
    // https://podcorn.com/analytics-prefix/
    // http redirects to target https
    m = /^https?:\/\/pdcn\.co\/e\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'podcorn', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://2.gum.fm/
    // http redirects to target https
    m = /^https?:\/\/2\.gum\.fm\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'gumball', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://s.gum.fm/r1/<24-hex-char>
    // http 308s to itself https
    m = /^https:\/\/s\.gum\.fm\/r1\/[0-9a-f]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'gumball', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://verifi.podscribe.com/rss/p/
    // https://podscribe.com/blog/impression-verification-mb45x
    // http not supported
    m = /^https:\/\/verifi\.podscribe\.com\/rss\/p\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'podscribe', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://claritaspod.com/measure/
    // https://claritas.com/podcast-attribution-audience-identification/
    // http redirects to target https
    m = /^https?:\/\/claritaspod\.com\/measure\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'claritas', url }, ...computeChainEstimate(targetUrl) ];
    }

    // final destination
    return [ { kind: 'destination', url } ];
}

export function normalizeOrigin(url: string): string {
    // htTps://HoSTname:443/patH -> https://hostname/patH
    const m = /^(https?):\/\/([^:\/]+)(:(\d+))?(\/.*?)?$/i.exec(url);
    if (!m) return url;
    const [ _, scheme, hostname, __, portNumStr, path = '' ] = m;
    const schemeLower = scheme.toLowerCase();
    const hostnameLower = hostname.toLowerCase();
    const portNum = typeof portNumStr === 'string' ? tryParseInt(portNumStr) : undefined;
    const port = typeof portNum === 'number' && !(schemeLower === 'http' && portNum === 80 || schemeLower === 'https' && portNum === 443) ? `:${portNum}` : '';
    return `${schemeLower}://${hostnameLower}${port}${path}`;
}

//

export type ChainEstimate = readonly ChainItem[];

export interface ChainItem {
    readonly url: string;
    readonly kind: 'prefix' | 'destination';
    readonly prefix?: 'op3' | 'podtrac' | 'podsights' | 'chartable' | 'veritonic' | 'artsai' | 'podcorn' | 'gumball' | 'podscribe' | 'claritas';
}
