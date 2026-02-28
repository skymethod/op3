import { XMLParser } from './deps.ts';
import { hasOp3InRedirectChain, hasOp3Reference, isRedirectFetchingRequired } from './fetch_redirects.ts';
import { parsePubdate } from './pubdates.ts';
import { isXfetchCandidate, Xfetcher, XResponse} from './xfetcher.ts';

export async function computeFeedAnalysis(feed: string, opts: { userAgent: string, xfetcher?: Xfetcher, maxRedirectFetches?: number }): Promise<FeedAnalysis> {
    const { userAgent, xfetcher, maxRedirectFetches = 10 } = opts;
    let remainingRedirectFetches = maxRedirectFetches;
    const res = await fetchAndHandleRedirects(feed, { headers: { 'user-agent': userAgent }, xfetcher });
    let items = 0;
    let itemsWithEnclosures = 0;
    let itemsWithOp3Enclosures = 0;
    let minPubdate: string | undefined;
    let maxPubdate: string | undefined;
    if (res.status === 200) {
        const p = new XMLParser({
            preserveOrder: true,
            processEntities: false,
            ignoreAttributes: false,
            commentPropName: '#comment',
            cdataPropName: '#cdata',
            alwaysCreateTextNode: true,
            attributeNamePrefix: '@_',
        });
        const top = p.parse(await res.text());
        const pubdates: string[] = [];
        let channelGenerator: string | undefined;
        for (const o of top) {
            if (o.rss) {
                for (const rss of o.rss) {
                    if (rss.channel) {
                        for (const channel of rss.channel) {
                            if (!channelGenerator && channel.generator) {
                                for (const generator of channel.generator) {
                                    const { '#text': text } = generator;
                                    if (typeof text === 'string' ) {
                                        channelGenerator = text;
                                    }
                                }
                            }
                            if (channel.item) {
                                items++;
                                let hasEnclosure = false;
                                let hasOp3Enclosure = false;
                                let pubdate: string | undefined;
                                for (const item of channel.item) {
                                    if (item.pubDate) {
                                        for (const pubDate of item.pubDate) {
                                            const { '#text': text } = pubDate;
                                            if (typeof text !== 'string') throw new Error(`Unexpected pubDate: ${JSON.stringify(item.pubDate)}`);
                                            const decoded = text.replaceAll('&#43;', '+');
                                            pubdate = parsePubdate(decoded);
                                        }
                                    }
                                    if (item.enclosure) {
                                        const atts = item[':@'];
                                        const { '@_url': urlAtt } = atts;
                                        const url = urlAtt.trim();
                                        if (url !== '') {
                                            hasEnclosure = true;
                                            if (hasOp3Reference(url)) {
                                                hasOp3Enclosure = true;
                                            } else if (isRedirectFetchingRequired({ generator: channelGenerator, enclosureUrl: url })) {
                                                if (!hasOp3Enclosure && remainingRedirectFetches > 0) {
                                                    if (await hasOp3InRedirectChain(url, opts)) {
                                                        hasOp3Enclosure = true;
                                                    }
                                                    remainingRedirectFetches--;
                                                }
                                            }
                                        }
                                    }
                                }
                                if (hasEnclosure) itemsWithEnclosures++;
                                if (hasEnclosure && pubdate) pubdates.push(pubdate);
                                if (hasOp3Enclosure) itemsWithOp3Enclosures++;
                            }
                        }
                    }
                }
            }
        }
        pubdates.sort();
        minPubdate = pubdates.at(0);
        maxPubdate = pubdates.at(-1);
    }
    return { feed, status: res.status, items, itemsWithEnclosures, itemsWithOp3Enclosures, minPubdate, maxPubdate };
}

//

async function fetchAndHandleRedirects(url: string, { headers, xfetcher }: { headers: Record<string, string>, xfetcher: Xfetcher | undefined }): Promise<Response | XResponse> {
    const rt: (Response | XResponse)[] = [];
    const urls = new Set<string>();
    const resToString = (res: Response | XResponse) => [ res.url, res.status, [...res.headers].map(v => v.join(': ')).join(',') ].join(', ');
    while (rt.length < 10) {
        if (urls.has(url)) throw new Error(`Circular redirect: ${rt.map(resToString).join(', ')}`);
        urls.add(url);
        let res: Response | XResponse = await fetch(url, { headers, redirect: 'manual' });
        rt.push(res);
        if (xfetcher && isXfetchCandidate(res as Response)) {
            res = await xfetcher(url, { headers: new Headers(headers), redirect: 'manual' });
            rt.push(res);
        }
        if ([ 301, 302, 307, 308 ].includes(res.status)) {
            const location = res.headers.get('location');
            if (typeof location === 'string') {
                url = new URL(location, new URL(url)).toString();
                continue;
            }
        }
        return rt.at(-1)!;
    }
    throw new Error(`Too many redirects: ${rt.map(resToString).join(', ')}`);
}

//

export interface FeedAnalysis {
    readonly feed: string;
    readonly status: number;
    readonly items: number;
    readonly itemsWithEnclosures: number;
    readonly itemsWithOp3Enclosures: number;
    readonly minPubdate?: string;
    readonly maxPubdate?: string;
}
