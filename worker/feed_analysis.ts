import { XMLParser } from './deps.ts';
import { hasOp3InRedirectChain, hasOp3Reference } from './fetch_redirects.ts';
import { parsePubdate } from './pubdates.ts';

export async function computeFeedAnalysis(feed: string, opts: { userAgent: string }): Promise<FeedAnalysis> {
    const { userAgent } = opts;
    const res = await fetch(feed, { headers: { 'user-agent': userAgent }});
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
                                            } else if (/castopod/i.test(channelGenerator ?? '')) {
                                                if (!hasOp3Enclosure && await hasOp3InRedirectChain(url, opts)) {
                                                    hasOp3Enclosure = true;
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

export interface FeedAnalysis {
    readonly feed: string;
    readonly status: number;
    readonly items: number;
    readonly itemsWithEnclosures: number;
    readonly itemsWithOp3Enclosures: number;
    readonly minPubdate?: string;
    readonly maxPubdate?: string;
}
