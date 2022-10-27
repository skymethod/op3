import { Callback, parseXml } from './xml_parser.ts';

export function parseFeed(feedBytes: BufferSource): Feed {
    let feedTitle: string | undefined;
    let itemGuid: string | undefined;
    let itemTitle: string | undefined;
    const items: Item[] = [];
    const callback: Callback = {
        onStartElement: (path) => {
            const xpath = '/' + path.join('/');
            if (xpath === '/rss/channel/item') {
                itemGuid = undefined;
                itemTitle = undefined;
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
                items.push({ guid: itemGuid, title: itemTitle });
            }
        },
    };
    parseXml(feedBytes, callback);
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
}
