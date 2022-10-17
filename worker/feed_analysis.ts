import { XMLParser } from 'https://cdn.skypack.dev/fast-xml-parser@4.0.11?dts';

export async function computeFeedAnalysis(feed: string, opts: { userAgent: string }): Promise<FeedAnalysis> {
    const { userAgent } = opts;
    const res = await fetch(feed, { headers: { 'user-agent': userAgent }});
    let items = 0;
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
        for (const o of top) {
            if (o.rss) {
                for (const rss of o.rss) {
                    if (rss.channel) {
                        for (const channel of rss.channel) {
                            if (channel.item) {
                                items++;
                            }
                        }
                    }
                }
            }
        }
    }
    return { feed, status: res.status, items };
}

//

export interface FeedAnalysis {
    readonly feed: string;
    readonly status: number;
    readonly items: number;
}
