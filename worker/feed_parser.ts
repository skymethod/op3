import { Callback, parseXml } from './xml_parser.ts';
import { tryParsePubdate } from './pubdates.ts';
import { tryParseUrl, undefinedIfBlank } from './check.ts';
import { decodeXml } from './deps.ts';

export function parseFeed(feedContents: BufferSource | string): Feed {
    let feedTitle: string | undefined;
    let feedLink: string | undefined;
    let feedPodcastGuid: string | undefined;
    let feedPodcastMedium: string | undefined;
    let feedGenerator: string | undefined;
    let feedItunesAuthor: string | undefined;
    let feedItunesCategories: ([ string ] | [ string, string ])[] | undefined;
    let feedItunesType: string | undefined;
    let feedValue: Value | undefined;
    let level = 0;
    let itemGuid: string | undefined;
    let itemTitle: string | undefined;
    const items: Item[] = [];
    let enclosures: Enclosure[] | undefined;
    let alternateEnclosures: AlternateEnclosure[] | undefined;
    let pubdate: string | undefined;
    let sources: Source[] | undefined;
    let transcripts: Transcript[] | undefined;
    let chapters: Chapters | undefined;
    let value: Value | undefined;
    let itunesDuration: string | undefined;
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
                chapters = undefined;
                value = undefined;
                itunesDuration = undefined;
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
                    if (attributes.size === 0 && transcripts.length === 0) {
                        // step 1 of 3 of the workaround for <podcast:transcript>https://podcast.example.com/path/to/transcript.srt</podcast:transcript>
                        transcripts.push({ url: 'WORKAROUND', type: 'WORKAROUND' });
                        return;
                    }
                    const url = attributes.get('url');
                    let type = attributes.get('type');
                    if (type === undefined && url) {
                        // workaround for RedCircle feeds with srt urls, but no type
                        const u = tryParseUrl(url);
                        if (u && /\.srt$/i.test(u.pathname)) {
                            type = 'application/x-subrip';
                        }
                    }
                    const language = attributes.get('language');
                    const rel = attributes.get('rel');

                    if (url === undefined || type === undefined) throw new Error(`Invalid transcript in item ${itemGuid}: ${JSON.stringify(Object.fromEntries(attributes))}`);
                    transcripts.push({ url, type, language, rel });
                }
            }
            if (xpath === '/rss/channel/item/podcast:chapters') {
                if (PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                    const url = attributes.get('url');
                    const type = attributes.get('type');
                    if (typeof url === 'string' && typeof type === 'string') {
                        chapters = { url, type };
                    }
                }
            }
            if (xpath === '/rss/channel/podcast:value' || '/rss/channel/item/podcast:value') {
                if (PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                    const method = attributes.get('method');
                    const type = attributes.get('type');
                    if (typeof method === 'string' && typeof type === 'string') {
                        const valueObj: Value = { method, type, recipients: [] };
                        if (xpath === '/rss/channel/podcast:value') {
                            feedValue = valueObj;
                        } else {
                            value = valueObj;
                        }
                    }
                }
            }
            if (xpath === '/rss/channel/podcast:value/podcast:valueRecipient' || xpath === '/rss/channel/item/podcast:value/podcast:valueRecipient') {
                if (PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                    const name = attributes.get('name');
                    const type = attributes.get('type');
                    const address = attributes.get('address');
                    const split = attributes.get('split');
                    const customKey = attributes.get('customKey');
                    const customValue = attributes.get('customValue');
                    const fee = attributes.get('fee');
                    if (typeof name === 'string' && typeof type === 'string' && typeof address === 'string' && typeof split === 'string') {
                        const rec: ValueRecipient = { name, type, address, split, customKey, customValue, fee };
                        if (xpath === '/rss/channel/podcast:value/podcast:valueRecipient') {
                            feedValue?.recipients.push(rec);
                        } else {
                            value?.recipients.push(rec);
                        }
                    }
                }
            }
            if (xpath === '/rss/channel/itunes:category' || xpath === '/rss/channel/itunes:category/itunes:category') {
                if (ITUNES_NAMESPACE_URI === (findNamespaceUri('itunes') ?? '')) {
                    feedItunesCategories = feedItunesCategories ?? [];
                    const text = attributes.get('text');
                    if (text !== undefined && text !== '') { // found <itunes:category text=""/>
                        if (typeof text !== 'string') throw new Error(`Invalid itunes:category text in item ${itemGuid}: ${JSON.stringify(Object.fromEntries(attributes))}`);
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
            if (xpath === '/rss/channel/podcast:guid' && PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) feedPodcastGuid = undefinedIfBlank(text);
            if (xpath === '/rss/channel/podcast:medium' && PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) feedPodcastMedium = undefinedIfBlank(text);
            if (xpath === '/rss/channel/itunes:author' && ITUNES_NAMESPACE_URI === (findNamespaceUri('itunes') ?? '')) feedItunesAuthor = text;
            if (xpath === '/rss/channel/itunes:type' && ITUNES_NAMESPACE_URI === (findNamespaceUri('itunes') ?? '')) feedItunesType = text;
            if (xpath === '/rss/channel/item/guid') itemGuid = text;
            if (xpath === '/rss/channel/item/title') itemTitle = decodeXml(text);
            if (xpath === '/rss/channel/item/pubDate') pubdate = decodeXml(text);
            if (xpath === '/rss/channel/item/itunes:duration' && ITUNES_NAMESPACE_URI === (findNamespaceUri('itunes') ?? '')) itunesDuration = text;
            if (xpath === '/rss/channel/item/podcast:transcript' && PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                if (transcripts?.length === 1 && transcripts.at(0)?.url === 'WORKAROUND') {
                    // step 2 of 3 of the workaround
                    transcripts.splice(0);
                    const url = text.trim();
                    if (!/^https?:\/\//i.test(url)) throw new Error(`Invalid podcast:transcript text`);
                    let type = 'text/plain';
                    const u = tryParseUrl(url);
                    if (u && /\.srt$/i.test(u.pathname)) {
                        type = 'application/x-subrip';
                    }
                    transcripts.push({ type, url });
                }
            }
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
                items.push({ guid: itemGuid, title: itemTitle, enclosures, alternateEnclosures, pubdate, pubdateInstant: tryParsePubdate(pubdate ?? ''), transcripts, chapters, value, itunesDuration });
            }
            if (xpath === '/rss/channel/item/podcast:transcript' && PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                // step 3 of 3 of the workaround
                if (transcripts?.length === 1 && transcripts[0].url === 'WORKAROUND') throw new Error(`Empty podcast:transcript`);
            }
            level--;
        },
    };
    parseXml(feedContents, callback);
    if (feedItunesCategories && !feedItunesCategories.every(isItunesCategory)) throw new Error(`Invalid itunesCategories: ${JSON.stringify(feedItunesCategories)}`);
    return { title: feedTitle, link: feedLink, podcastGuid: feedPodcastGuid, medium: feedPodcastMedium, generator: feedGenerator, itunesAuthor: feedItunesAuthor, itunesType: feedItunesType, itunesCategories: feedItunesCategories, value: feedValue, items };
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
    readonly medium?: string;
    readonly itunesAuthor?: string;
    readonly itunesType?: string;
    readonly itunesCategories?: ItunesCategory[];
    readonly items: readonly Item[];
    readonly value?: Value;
}

export interface Item {
    readonly title?: string;
    readonly guid?: string;
    readonly pubdate?: string;
    readonly pubdateInstant?: string;
    readonly enclosures?: Enclosure[];
    readonly alternateEnclosures?: AlternateEnclosure[];
    readonly transcripts?: Transcript[];
    readonly chapters?: Chapters;
    readonly value?: Value;
    readonly itunesDuration?: string;
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

export interface Chapters {
    readonly url: string;
    readonly type: string;
}

export interface Value {
    readonly type: string;
    readonly method: string;
    readonly recipients: ValueRecipient[];
}

export interface ValueRecipient {
    readonly type: string;
    readonly name?: string;
    readonly address: string;
    readonly customKey?: string;
    readonly customValue?: string;
    readonly fee?: string;
    readonly split: string;
}

//

const PODCAST_NAMESPACE_URIS = new Set<string>([ 'https://podcastindex.org/namespace/1.0', 'https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md' ]);

const ITUNES_NAMESPACE_URI = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
