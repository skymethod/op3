import { tryParseInt, tryParseUrl } from './check.ts';

export function computeChainDestinationUrl(url: string): string | undefined {
    const estimate = computeChainEstimate(url);
    const last = estimate.at(-1);
    return last && last.kind === 'destination' ? last.url : undefined;
}

export function computeChainDestinationHostname(url: string, { urlDecodeIfNecessary }: { urlDecodeIfNecessary?: boolean } = {}): string | undefined {
    const destinationUrl = computeChainDestinationUrl(url);
    const rt = destinationUrl ? tryParseUrl(destinationUrl)?.hostname : undefined;
    return !rt && destinationUrl && urlDecodeIfNecessary ? tryParseUrl(destinationUrl.replaceAll(/%2f/ig, '/'))?.hostname : rt;
}

export function computeChainEstimate(url: string): ChainEstimate {

    url = normalizeOrigin(url);

    // https://op3.dev/e(,args)?/(https?://)?
    // no http support (.dev TLD on HSTS preload list), but clients (browsers) redirect anyway?
    let m = /^https?:\/\/(ci\.|staging\.)?\op3\.dev(:443|:80)?\/e(,.*?)?\/(.+?)$/.exec(url);
    if (m) {
        const [ _, _subdomain, _port, _args, suffix ] = m;
        m = /^((https?):\/\/?).*?$/i.exec(suffix);
        const targetUrl = m ? `${m[2].toLowerCase()}://${suffix.substring(m[1].length)}` : `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'op3', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://dts.podtrac.com/redirect.mp3/
    // https://www.podtrac.com/pts/redirect.mp3/
    // https://dts.podtrac.com/redirect.m4a/
    // https://play.podtrac.com/ABC-Whatever/
    // http redirects to https for registered feeds
    // supports explicit protocol as well: https://dts.podtrac.com/redirect.mp3/http://example.com/path-to-file.mp3
    m = /^https?:\/\/(dts\.podtrac\.com|www\.podtrac\.com\/pts|play\.podtrac\.com)\/(redirect\.[a-z0-9]+|[a-zA-Z0-9-]+)\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, _domain, _redirect, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? `https://`}${suffix}`;
        return [ { kind: 'prefix', prefix: 'podtrac', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pdst.fm/e/
    // http redirects to target http
    m = /^(https?):\/\/pdst\.fm\/e\/(.*?)(\?.*?)?$/.exec(url);
    if (m) {
        const [ _, scheme, suffix, qs = '' ] = m;
        const unescapedSuffix = suffix.replaceAll('%2F', '/');
        const targetUrl = `${scheme}://${unescapedSuffix}${qs === '?' ? '' : qs}`;
        return [ { kind: 'prefix', prefix: 'podsights', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://chrt.fm/track/CHRT123/
    // also chtbl.com/track/12345
    // http redirects to target http
    m = /^(https?):\/\/(chrt\.fm|chtbl\.com)\/track\/[^/]+\/((https?):\/\/?)?(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, _domain, _suffixProtocol, suffixScheme, suffix ] = m;
        const targetUrl = `${suffixScheme ?? scheme}://${suffix}`;
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
    m = /^https?:\/\/pdcn\.co\/e\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? 'https://'}${suffix}`;
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
    // 2022-12-05: alt https://pscrb.fm/rss/p/
    m = /^https:\/\/(verifi\.podscribe\.com|pscrb\.fm)\/rss\/p\/(.*?)$/.exec(url);
    if (m) {
        const [ _, _hostname, suffix ] = m;
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

    // https://growx.podkite.com/https/1234ASDF/
    // http and https endpoints are supported, but destination determined by parameter
    m = /^https?:\/\/growx\.podkite\.com\/(https?)\/[A-Za-z0-9]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, suffix ] = m;
        const targetUrl = `${scheme}://${suffix}`;
        return [ { kind: 'prefix', prefix: 'podkite', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://media.blubrry.com/something/a.com/path/to/episode.mp3
    // http and https endpoints are supported
    m = /^(https?):\/\/media\.blubrry\.com\/\w+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, suffix ] = m;
        const targetUrl = `${scheme}://${suffix}`;
        return [ { kind: 'prefix', prefix: 'blubrry', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://mgln.ai/track/a.com/path/to/episode.mp3
    // http and https endpoints are supported, but suffix protocol must be used for https
    m = /^https?:\/\/mgln\.ai\/track\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? `https://`}${suffix}`;
        return [ { kind: 'prefix', prefix: 'magellan', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://p.podderapp.com/1234567890/
    // http redirects to self https, suffix protocol supported
    m = /^https?:\/\/p\.podderapp\.com\/\d+\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? `https://`}${suffix}`;
        return [ { kind: 'prefix', prefix: 'podder', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://r.zen.ai/r/a.com/path/to/episode.mp3
    // http redirects to self https, suffix protocol supported, but not used! always https
    m = /^https?:\/\/r\.zen\.ai\/r\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, _suffixProtocol, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'zencastr', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://t.glystn.com/v2/track/PID-1234abcd/a.com/path/to/episode.mp3
    // http fails, suffix protocol supported
    m = /^https?:\/\/t\.glystn\.com\/v2\/track\/[^/]+\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? `https://`}${suffix}`;
        return [ { kind: 'prefix', prefix: 'glystn', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://adbarker.com/stream/asdfASDf1345asdfASDf1345/a.com/path/to/episode.mp3
    // http and https supported, suffix protocol trumps
    m = /^(https?):\/\/adbarker\.com\/stream\/[^/]+\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? `${scheme}://`}${suffix}`;
        return [ { kind: 'prefix', prefix: 'adbarker', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://letscast.fm/track/https://a.com/path/to/episode.mp3
    // http and https supported, suffix protocol is required
    m = /^(https?):\/\/letscast\.fm\/track\/(https?:\/\/)(.*?)$/.exec(url);
    if (m) {
        const [ _, _scheme, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol}${suffix}`;
        return [ { kind: 'prefix', prefix: 'letscast', url }, ...computeChainEstimate(targetUrl) ];
    }

    // final destination
    return [ { kind: 'destination', url } ];
}

export function normalizeOrigin(url: string): string {
    // htTps://HoSTname:443/patH -> https://hostname/patH
    const m = /^(https?):\/\/([a-zA-Z0-9.-]+)(:(\d+))?(\/.*?)?$/i.exec(url);
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
    readonly prefix?: 'op3'
        | 'adbarker'
        | 'artsai'
        | 'blubrry'
        | 'chartable'
        | 'claritas'
        | 'glystn'
        | 'letscast'
        | 'gumball'
        | 'magellan'
        | 'podcorn'
        | 'podder'
        | 'podkite'
        | 'podscribe'
        | 'podsights'
        | 'podtrac'
        | 'veritonic'
        | 'zencastr'
        ;
}
