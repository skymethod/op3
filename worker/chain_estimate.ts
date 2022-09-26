import { tryParseUrl } from './check.ts';

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

    // final destination
    return [ { kind: 'destination', url } ];
}

//

export type ChainEstimate = readonly ChainItem[];

export interface ChainItem {
    readonly url: string;
    readonly kind: 'prefix' | 'destination';
    readonly prefix?: 'op3' | 'podtrac' | 'podsights' | 'chartable' | 'veritonic' | 'artsai' | 'podcorn' | 'gumball';
}
