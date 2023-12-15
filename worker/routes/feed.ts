import { encodeXml } from '../deps.ts';
import { computeRfc822 } from '../timestamp.ts';
import { computeMarkdownHtml, computeMarkdownText } from './markdown.ts';

export interface FeedItem {
    readonly id: string;
    readonly time: string; // instant
    readonly title: string;
    readonly bulletPoints: readonly BulletPoint[];
}

export type BulletPoint = (opts: { origin: string }) => string;

//

export function tryParseFeedRequest({ method, pathname, headers, expectedPath }: { method: string, pathname: string, headers: Headers, expectedPath: string }): { method: string, type: 'rss' | 'html' } | undefined {
    const m = /^\/([a-z]+)(\.rss)?$/.exec(pathname);
    return m && m[1] === expectedPath ? { method, type: m[2] === '.rss' || (headers.get('accept') ?? '').includes('application/rss+xml') ? 'rss' : 'html' } : undefined;
}

export const computeRss = ({ items, title, description, origin, pathname }: { items: FeedItem[], title: string, description: string, origin: string, pathname: string }) => `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${encodeXml(title)}</title>
    <link>${origin}${pathname}</link>
    <description>${encodeXml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${computeRfc822(items[0].time)}</lastBuildDate>
    <atom:link href="${origin}${pathname}.rss" rel="self" type="application/rss+xml" />
${items.map(v => `
    <item>
      <title>${encodeXml(v.title)}</title>
      <link>${origin}${pathname}#${v.id}</link>
      <pubDate>${computeRfc822(v.time)}</pubDate>
      <guid>${origin}${pathname}#${v.id}</guid>
      <description>${encodeXml(computeBulletPointsDescription(v.bulletPoints, { origin }))}</description>
      <content:encoded>${encodeXml(computeBulletPointsHtml(v.bulletPoints, { origin }))}</content:encoded>
    </item>  
`).join('')}
  </channel>
</rss>
`

export const computeBasicHtml = ({ items, origin }: { items: FeedItem[], origin: string }) =>
    items.map(v => `
        <h4 id="${v.id}">${encodeXml(v.title)}</h4>
        ${computeBulletPointsHtml(v.bulletPoints, { origin })}
    `).join('\n\n');

//

function computeBulletPointsHtml(bulletPoints: readonly BulletPoint[], { origin }: { origin: string }): string {
    return `<ul>${bulletPoints.map(v => `<li>${computeMarkdownHtml(v({ origin }))}</li>\n`).join('')}</ul>`
}

function computeBulletPointsDescription(bulletPoints: readonly BulletPoint[], { origin }: { origin: string }): string {
    return bulletPoints.map(v => ` • ${computeMarkdownText(v({ origin }))}\n`).join('');
}
