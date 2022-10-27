import { tryParseUrl } from './check.ts';
import { Callback, parseXml } from './xml_parser.ts';

export function parseFeed(feedContents: BufferSource | string): Feed {
    let feedTitle: string | undefined;
    let itemGuid: string | undefined;
    let itemTitle: string | undefined;
    const items: Item[] = [];
    let enclosureUrls: string[] | undefined;
    let alternateEnclosureUrls: string[] | undefined;
    const callback: Callback = {
        onStartElement: (path, attributes, findNamespaceUri) => {
            const xpath = '/' + path.join('/');
            if (xpath === '/rss/channel/item') {
                itemGuid = undefined;
                itemTitle = undefined;
                enclosureUrls = undefined;
                alternateEnclosureUrls = undefined;
            }
            if (xpath === '/rss/channel/item/enclosure') {
                const url = attributes.get('url');
                if (typeof url === 'string') {
                    enclosureUrls = enclosureUrls ?? [];
                    enclosureUrls.push(url);
                }
            }
            if (xpath === '/rss/channel/item/podcast:alternateEnclosure/podcast:source') {
                if (PODCAST_NAMESPACE_URIS.has(findNamespaceUri('podcast') ?? '')) {
                    const uri = attributes.get('uri');
                    if (typeof uri === 'string') {
                        const url = tryParseUrl(uri);
                        if (url) {
                            alternateEnclosureUrls = alternateEnclosureUrls ?? [];
                            alternateEnclosureUrls.push(uri);
    
                        }
                    }
                }
            }
        },
        onText: (text, path, _attributes) => {
            const xpath = '/' + path.join('/');
            if (xpath === '/rss/channel/title') feedTitle = text;
            if (xpath === '/rss/channel/item/guid') itemGuid = text;
            if (xpath === '/rss/channel/item/title') itemTitle = text;
        },
        onEndElement: (path) => {
            const xpath = '/' + path.join('/');
            if (xpath === '/rss/channel/item') {
                items.push({ guid: itemGuid, title: itemTitle, enclosureUrls, alternateEnclosureUrls });
            }
        },
    };
    parseXml(feedContents, callback);
    return { title: feedTitle, items };
}

//

export interface Feed {
    readonly title?: string;
    readonly items: readonly Item[];
}

export interface Item {
    readonly title?: string;
    readonly guid?: string;
    readonly enclosureUrls?: string[];
    readonly alternateEnclosureUrls?: string[];
}

//

const PODCAST_NAMESPACE_URIS = new Set<string>([ 'https://podcastindex.org/namespace/1.0', 'https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md' ]);
