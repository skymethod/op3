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
    let m = /^https?:\/\/(ci\.|staging\.)?\op3\.dev(:443|:80)?\/e(,.*?)?\/\/?(.+?)$/.exec(url);
    if (m) {
        const [ _, _subdomain, _port, _args, suffix ] = m;
        m = /^((https?):\/\/?).*?$/i.exec(suffix);
        const targetUrl = m ? `${m[2].toLowerCase()}://${suffix.substring(m[1].length)}` : `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'op3', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://dts.podtrac.com/redirect.mp3/
    // https://www.podtrac.com/pts/redirect.mp3/
    // https://dts.podtrac.com/pts/redirect.mp3/
    // https://podtrac.com/pts/redirect.mp3/
    // https://dts.podtrac.com/redirect.m4a/
    // https://play.podtrac.com/ABC-Whatever/
    // http redirects to https for registered feeds
    // supports explicit protocol as well: https://dts.podtrac.com/redirect.mp3/http://example.com/path-to-file.mp3
    m = /^https?:\/\/(dts\.podtrac\.com(\/pts)?|www\.podtrac\.com\/pts|podtrac\.com\/pts|play\.podtrac\.com)\/(redirect\.[a-z0-9]+|[a-zA-Z0-9-]+)\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, _domain, __, _redirect, suffixProtocol, suffix ] = m;
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
    // suffix protocol doesn't actually forward https%3A, but include it here to compute target hostname (found from podhero)
    m = /^(https?):\/\/(chrt\.fm|chtbl\.com)\/track\/[^/]+\/((https?)(:|%3A)\/\/?)?(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, _domain, _suffixProtocol, suffixScheme, _suffixColon, suffix ] = m;
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
    // https://s.gum.fm/s-631f86ba3727560f9608b68b
    // http 308s to itself https
    m = /^https:\/\/s\.gum\.fm\/(r1\/|s-)[0-9a-f]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, __, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'gumball', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://verifi.podscribe.com/rss/p/
    // https://podscribe.com/blog/impression-verification-mb45x
    // http not supported
    // suffix protocol supported
    // 2022-12-05: alt https://pscrb.fm/rss/p/
    m = /^https:\/\/(verifi\.podscribe\.com|pscrb\.fm)\/rss\/p\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, _hostname, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? 'https://'}${suffix}`;
        return [ { kind: 'prefix', prefix: 'podscribe', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://claritaspod.com/measure/
    // https://www.claritaspod.com/measure/
    // https://clrtpod.com/m/
    // https://claritas.com/podcast-attribution-audience-identification/
    // http redirects to target https
    m = /^https?:\/\/((www\.)?claritaspod\.com\/measure|clrtpod\.com\/m)\/(.*?)$/.exec(url);
    if (m) {
        const [ _, __, ___, suffix ] = m;
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
    // https://media.blubrry.com/something/https://a.com/path/to/episode.mp3
    // http and https endpoints are supported
    m = /^(https?):\/\/media\.blubrry\.com\/\w+\/(p\/)?(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, __, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? `${scheme}://`}${suffix}`;
        return [ { kind: 'prefix', prefix: 'blubrry', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://mgln.ai/track/a.com/path/to/episode.mp3
    // https://mgln.ai/e/256/a.com/path/to/episode.mp3
    // http and https endpoints are supported, but suffix protocol must be used for https
    m = /^https?:\/\/mgln\.ai\/(track|e\/[a-z0-9]+)\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, __, suffixProtocol, suffix ] = m;
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
    m = /^https?:\/\/r\.(zen\.ai|zencastr\.com)\/r\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, __, _suffixProtocol, suffix ] = m;
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
    m = /^(https?):\/\/letscast\.fm\/track\/(https?:\/\/?)(.*?)$/.exec(url);
    if (m) {
        const [ _, _scheme, suffixProtocolStr, suffix ] = m;
        const suffixProtocol = suffixProtocolStr.endsWith(':/') ? (suffixProtocolStr + '/') : suffixProtocolStr;
        const targetUrl = `${suffixProtocol}${suffix}`;
        return [ { kind: 'prefix', prefix: 'letscast', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pfx.vpixl.com/123az/a.com/path/to/episode.mp3
    // only https supported, suffix protocol supported but ignored, always forwards to https
    m = /^(https?):\/\/pfx\.vpixl\.com\/[^/]+\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, _scheme, _suffixProtocol, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'vpixl', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://bktrks.co/t/1234abcd1234abcd/a.com/path/to/episode.mp3
    // http and https supported, suffix protocol trumps
    m = /^(https?):\/\/bktrks\.co\/t\/[^/]+\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? `${scheme}://`}${suffix}`;
        return [ { kind: 'prefix', prefix: 'backtracks', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pdrl.fm/123abc/a.com/path/to/episode.mp3
    // https://pdrl.fm/r/86c73b/6f0827/a.com/path/to/episode.mp3
    // https://rss.pdrl.fm/12345c/a.com/path/to/episode.mp3
    // http and https supported, suffix protocol trumps
    m = /^(https?):\/\/(rss\.)?pdrl\.fm\/(r\/[^/]+\/[^/]+|[^/]+)\/(https?:\/\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, scheme, __, ___, suffixProtocol, suffix ] = m;
        const targetUrl = `${suffixProtocol ?? `${scheme}://`}${suffix}`;
        return [ { kind: 'prefix', prefix: 'podroll', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://a.pdcst.to/abcdWXYZ01234567/a.com/path/to/episode.mp3
    // https://help.voxalyze.com/article/61-tracking-prefix
    // https?/ and https?:// are supported, but ignored: https is always used
    m = /^(https?):\/\/a\.pdcst\.to\/[^/]+\/(https?(:\/)?\/)?(.*?)$/.exec(url);
    if (m) {
        const [ _, _scheme, _suffixProtocolOrPrefix, __, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'voxalyze', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://prfx.byspotify.com/e/a.com/path/to/episode.mp3
    // https://help.adanalytics.spotify.com/install-the-spotify-ad-analytics-podcast-prefix
    // https by default, suffix protocol trumps
    m = /^https?:\/\/prfx\.byspotify\.com\/e\/((https?):\/\/?)?(.*?)$/.exec(url);
    if (m) {
        const [ _, __, suffixScheme, suffix ] = m;
        const targetUrl = `${suffixScheme ?? 'https' }://${suffix}`;
        return [ { kind: 'prefix', prefix: 'spotify', url }, ...computeChainEstimate(targetUrl) ];
    }

    // not really a prefix, it takes over the request after grabbing the target once
    // but useful to include here for estimation
    m = /^https?:\/\/ipfspodcasting\.net\/e\/((https?):\/\/?)?(.*?)$/.exec(url);
    if (m) {
        const [ _, __, suffixScheme, suffix ] = m;
        const targetUrl = `${suffixScheme ?? 'https' }://${suffix}`;
        return [ { kind: 'prefix', prefix: 'ipfspodcasting', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://cohst.app/pdcst/123ABC/a.com/path/to/episode.mp3
    // http redirects to https
    // no suffix protocol support
    m = /^https?:\/\/cohst\.app\/pdcst\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'cohost', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://swap.fm/track/12345ABCDEabcde12345/a.com/path/to/episode.mp3
    // https://tracking.swap.fm/track/12345ABCDEabcde12345/a.com/path/to/episode.mp3
    // http redirects to https
    // no suffix protocol support
    m = /^https?:\/\/(tracking\.)?swap\.fm\/track\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, __, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'swapfm', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pdcds.co/asdfg12345/a.com/path/to/episode.mp3
    // http redirects to https
    // no suffix protocol support
    m = /^https?:\/\/pdcds\.co\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'podcards', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://prefix.up.audio/s/a.com/path/to/episode.mp3
    // http redirects to https
    // no suffix protocol support
    m = /^https?:\/\/prefix\.up\.audio\/s\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'unitedpodcasters', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://m.pfxes.com/ABCDabcd/a.com/path/to/episode.mp3
    // http redirects to https
    // no suffix protocol support
    m = /^https?:\/\/m\.pfxes\.com\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'pfxes', url }, ...computeChainEstimate(targetUrl) ];
    }

    // https://pp.example.com/protect/example/a.com/path/to/episode.mp3
    // https://pp1.example.com/protect/example/a.com/path/to/episode.mp3
    // http supported
    // no suffix protocol support
    m = /^https?:\/\/pp\d*\.[a-z0-9.-]+\/protect\/[^/]+\/(.*?)$/.exec(url);
    if (m) {
        const [ _, suffix ] = m;
        const targetUrl = `https://${suffix}`;
        return [ { kind: 'prefix', prefix: 'ppprotect', url }, ...computeChainEstimate(targetUrl) ];
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
        | 'backtracks'
        | 'blubrry'
        | 'chartable'
        | 'claritas'
        | 'cohost'
        | 'glystn'
        | 'gumball'
        | 'ipfspodcasting'
        | 'letscast'
        | 'magellan'
        | 'pfxes'
        | 'podcards'
        | 'podcorn'
        | 'podder'
        | 'podkite'
        | 'podroll'
        | 'podscribe'
        | 'podsights'
        | 'podtrac'
        | 'ppprotect'
        | 'spotify'
        | 'swapfm'
        | 'unitedpodcasters'
        | 'veritonic'
        | 'voxalyze'
        | 'vpixl'
        | 'zencastr'
        ;
}
