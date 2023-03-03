import { Callback, parseXml } from './xml_parser.ts';
import { tryParsePubdate } from './pubdates.ts';

export function parseFeed(feedContents: BufferSource | string): Feed {
    let feedTitle: string | undefined;
    let feedLink: string | undefined;
    let feedPodcastGuid: string | undefined;
    let feedGenerator: string | undefined;
    let feedItunesAuthor: string | undefined;
    let feedItunesCategories: ([ string ] | [ string, string ])[] | undefined;
    let feedItunesType: string | undefined;
    let level = 0;
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
            level++;
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
            if (xpath === '/rss/channel/itunes:category' || xpath === '/rss/channel/itunes:category/itunes:category') {
                if (ITUNES_NAMESPACE_URI === (findNamespaceUri('itunes') ?? '')) {
                    feedItunesCategories = feedItunesCategories ?? [];
                    const text = attributes.get('text');
                    if (text !== undefined) {
                        if (typeof text !== 'string' || text === '') throw new Error(`Invalid itunes:category text in item ${itemGuid}: ${JSON.stringify(Object.fromEntries(attributes))}`);
                        if (level === 3) {
                            feedItunesCategories.push([ text ]);
                        } else if (level === 4) {
                            const latestCategory = feedItunesCategories.at(-1);
                            if (latestCategory) {
                                if (latestCategory.length === 1) {
                                    latestCategory.push(text);
                                } else if (latestCategory.length === 2) {
                                    feedItunesCategories.push([ latestCategory[0], text ]);
                                }
                            }
                        }
                    }
                }
            }
        },
        onText: (text, path, _attributes, findNamespaceUri) => {
            const xpath = '/' + path.join('/');
            if (xpath === '/rss/channel/title') feedTitle = text;
            if (xpath === '/rss/channel/link') feedLink = text;
            if (xpath === '/rss/channel/generator') feedGenerator = text;
            if (xpath === '/rss/channel/podcast:guid' && PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) feedPodcastGuid = text;
            if (xpath === '/rss/channel/itunes:author' && ITUNES_NAMESPACE_URI === (findNamespaceUri('itunes') ?? '')) feedItunesAuthor = text;
            if (xpath === '/rss/channel/itunes:type' && ITUNES_NAMESPACE_URI === (findNamespaceUri('itunes') ?? '')) feedItunesType = text;
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
            level--;
        },
    };
    parseXml(feedContents, callback);
    if (feedItunesCategories && !feedItunesCategories.every(isItunesCategory)) throw new Error(`Invalid itunesCategories: ${JSON.stringify(feedItunesCategories)}`);
    return { title: feedTitle, link: feedLink, podcastGuid: feedPodcastGuid, generator: feedGenerator, itunesAuthor: feedItunesAuthor, itunesType: feedItunesType, itunesCategories: feedItunesCategories, items };
}

//

export type ItunesCategory = [ string ] | [ string, string ];

export function isItunesCategory(obj: unknown): obj is ItunesCategory {
    return Array.isArray(obj) && obj.length >= 1 && obj.length <= 2 && obj.every(v => typeof v === 'string');
}

export function equalItunesCategories(lhs: ItunesCategory[] | undefined, rhs: ItunesCategory[] | undefined): boolean {
    if (lhs === undefined && rhs === undefined) return true;
    if (lhs !== undefined && rhs !== undefined) {
        return lhs.length === rhs.length && lhs.every((v, i) => equalItunesCategory(v, rhs[i]));
    }
    return false;
}

export function equalItunesCategory(lhs: ItunesCategory, rhs: ItunesCategory): boolean {
    return lhs.length === rhs.length && lhs.every((v, i) => v === rhs[i]);
}

export function stringifyItunesCategories(itunesCategories: ItunesCategory[] | undefined): string | undefined {
    return itunesCategories === undefined ? undefined : itunesCategories.map(stringifyItunesCategory).join(', ');
}

export function stringifyItunesCategory(itunesCategory: ItunesCategory): string {
    return itunesCategory.join(' > ');
}

export interface Feed {
    readonly title?: string;
    readonly link?: string;
    readonly podcastGuid?: string;
    readonly generator?: string;
    readonly itunesAuthor?: string;
    readonly itunesType?: string;
    readonly itunesCategories?: ItunesCategory[];
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

const ITUNES_NAMESPACE_URI = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
