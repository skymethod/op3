
export function computeChainDestination(url: string): string {
    const estimate = computeChainEstimate(url);
    const last = estimate.at(-1);
    return last && last.kind === 'destination' ? last.url : url;
}

export function computeChainEstimate(url: string): ChainEstimate {

    // https://op3.dev/e/(https?://)?
    let m = /^https:\/\/\op3\.dev\/e\/(.+?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        m = /^((https?):\/\/?).*?$/i.exec(suffix);
        const targetUrl = m ? `${m[2].toLowerCase()}://${suffix.substring(m[1].length)}` : `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'op3', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://dts.podtrac.com/redirect.mp3/
    m = /^https:\/\/dts\.podtrac\.com\/redirect\.mp3\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'podtrac', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pdst.fm/e/
    m = /^https:\/\/pdst\.fm\/e\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'podsights', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://chrt.fm/track/CHRT123/
    m = /^https:\/\/chrt\.fm\/track\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'chartable', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pfx.veritonicmetrics.com/vt123/
    m = /^https:\/\/pfx\.veritonicmetrics\.com\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'veritonic', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://arttrk.com/p/ARTS1/
    m = /^https:\/\/arttrk\.com\/p\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'artsai', url }, ...computeChainEstimate(targetUrl) ];
    }

    // final destination
    return [ { kind: 'destination', url } ];
}

//

export type ChainEstimate = readonly ChainItem[];

export interface ChainItem {
    readonly url: string;
    readonly kind: 'prefix' | 'destination';
    readonly prefix?: 'op3' | 'podtrac' | 'podsights' | 'chartable' | 'veritonic' | 'artsai';
}
