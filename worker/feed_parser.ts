import { Callback, parseXml } from './xml_parser.ts';
import { tryParsePubdate } from './pubdates.ts';

export function parseFeed(feedContents: BufferSource | string): Feed {
    let feedTitle: string | undefined;
    let feedPodcastGuid: string | undefined;
    let feedGenerator: string | undefined;
    let itemGuid: string | undefined;
    let itemTitle: string | undefined;
    const items: Item[] = [];
    let enclosures: Enclosure[] | undefined;
    let alternateEnclosures: AlternateEnclosure[] | undefined;
    let pubdate: string | undefined;
    let sources: Source[] | undefined;
    let transcripts: Transcript[] | undefined;
    const callback: Callback = {
        onStartElement: (path, attributes, findNamespaceUri) => {
            const xpath = '/' + path.join('/');
            if (xpath === '/rss/channel/item') {
                itemGuid = undefined;
                itemTitle = undefined;
                enclosures = undefined;
                alternateEnclosures = undefined;
                pubdate = undefined;
                transcripts = undefined;
            }
            if (xpath === '/rss/channel/item/enclosure') {
                const url = attributes.get('url');
                enclosures = enclosures ?? [];
                enclosures.push({ url });
            }
            if (xpath === '/rss/channel/item/podcast:alternateEnclosure') {
                if (PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                    sources = undefined;
                }
            }
            if (xpath === '/rss/channel/item/podcast:alternateEnclosure/podcast:source') {
                if (PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                    const uri = attributes.get('uri');
                    sources = sources ?? [];
                    sources.push({ uri });
                }
            }
            if (xpath === '/rss/channel/item/podcast:transcript') {
                if (PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                    transcripts = transcripts ?? [];
                    const url = attributes.get('url');
                    const type = attributes.get('type');
                    const language = attributes.get('language');
                    const rel = attributes.get('rel');
                    if (url === undefined || type === undefined) throw new Error(`Invalid transcript in item ${itemGuid}: ${JSON.stringify(Object.fromEntries(attributes))}`);
                    transcripts.push({ url, type, language, rel });
                }
            }
        },
        onText: (text, path, _attributes, findNamespaceUri) => {
            const xpath = '/' + path.join('/');
            if (xpath === '/rss/channel/title') feedTitle = text;
            if (xpath === '/rss/channel/generator') feedGenerator = text;
            if (xpath === '/rss/channel/podcast:guid' && PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) feedPodcastGuid = text;
            if (xpath === '/rss/channel/item/guid') itemGuid = text;
            if (xpath === '/rss/channel/item/title') itemTitle = text;
            if (xpath === '/rss/channel/item/pubDate') pubdate = text;
        },
        onEndElement: (path, _attributes, findNamespaceUri) => {
            const xpath = '/' + path.join('/');
            if (xpath === '/rss/channel/item/podcast:alternateEnclosure') {
                if (PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                    alternateEnclosures = alternateEnclosures ?? [];
                    alternateEnclosures.push({ sources });
                }
            }
            if (xpath === '/rss/channel/item') {
                items.push({ guid: itemGuid, title: itemTitle, enclosures, alternateEnclosures, pubdate, pubdateInstant: tryParsePubdate(pubdate ?? ''), transcripts });
            }
        },
    };
    parseXml(feedContents, callback);
    return { title: feedTitle, podcastGuid: feedPodcastGuid, generator: feedGenerator, items };
}

//

export interface Feed {
    readonly title?: string;
    readonly podcastGuid?: string;
    readonly generator?: string;
    readonly items: readonly Item[];
}

export interface Item {
    readonly title?: string;
    readonly guid?: string;
    readonly pubdate?: string;
    readonly pubdateInstant?: string;
    readonly enclosures?: Enclosure[];
    readonly alternateEnclosures?: AlternateEnclosure[];
    readonly transcripts?: Transcript[];
}

export interface Enclosure {
    readonly url?: string;
}

export interface AlternateEnclosure {
    readonly sources?: Source[];
}

export interface Source {
    readonly uri?: string;
}

export interface Transcript {
    readonly url: string;
    readonly type: string;
    readonly language?: string;
    readonly rel?: string;
}

//

const PODCAST_NAMESPACE_URIS = new Set<string>([ 'https://podcastindex.org/namespace/1.0', 'https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md' ]);
