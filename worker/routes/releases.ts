import { importText, encodeXml } from '../deps.ts';
import { computeRfc822 } from '../timestamp.ts';
import { computeCloudflareAnalyticsSnippet } from './html.ts';
import { computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';
import { computeMarkdownHtml, computeMarkdownText } from './markdown.ts';
import { newMethodNotAllowedResponse, newRssResponse } from './responses.ts';
const releasesHtm = await importText(import.meta.url, '../static/releases.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function tryParseReleasesRequest(opts: { method: string, pathname: string, headers: Headers}): ReleasesRequest | undefined {
    const { method, pathname, headers } = opts;
    const m = /^\/releases(\.rss)?$/.exec(pathname);
    return m ? { method, type: m[1] === '.rss' || (headers.get('accept') ?? '').includes('application/rss+xml') ? 'rss' : 'html' } : undefined;
}

export function computeReleasesResponse({ method, type } : ReleasesRequest, { instance, origin, productionOrigin, cfAnalyticsToken }: { instance: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined }): Response {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    const titleSuffix = instance === 'prod' ? '' : ` (${instance})`;
    const title = `Releases · OP3${titleSuffix}: The Open Podcast Prefix Project`;

    if (type === 'rss') return newRssResponse(computeReleasesRss({ title, origin }));

    const html = computeHtml(releasesHtm, {
        title,
        styleTag: `<style>\n${outputCss}\n</style>`,
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        basicHtml: computeBasicHtml({ origin }),
        origin,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}

//

export interface ReleasesRequest {
    readonly method: string;
    readonly type: 'html' | 'rss';
}

//

type BulletPoint = (opts: { origin: string }) => string;

interface Release {
    readonly id: string;
    readonly time: string; // instant
    readonly title: string;
    readonly bulletPoints: readonly BulletPoint[];
}

//

const RELEASES: Release[] = [
    {
        id: '2022-09-15',
        time: '2022-09-15T23:33:00.000Z',
        title: '2022-09-15: Initial launch! Prefix redirect and Data API preview',
        bulletPoints: [
            ({ origin }) => `New podcast episode prefix service: ${origin}/e/ ready to use - safely and securely stores basic episode request attributes.`,
            ({ origin }) => `New API and associated [API Documentation](${origin}/api/docs) providing open access to low-level episode data, as a preview of what's to come.`,
            () => `Existing podcasters can contribute real data to this project by adding the prefix to the episode urls in their podcast RSS feed.`,
        ]
    }
];

function computeBulletPointsHtml(bulletPoints: readonly BulletPoint[], { origin }: { origin: string }): string {
    return `<ul>${bulletPoints.map(v => `<li>${computeMarkdownHtml(v({ origin }))}</li>\n`).join('')}</ul>`
}

function computeBulletPointsDescription(bulletPoints: readonly BulletPoint[], { origin }: { origin: string }): string {
    return bulletPoints.map(v => ` • ${computeMarkdownText(v({ origin }))}\n`).join('');
}

function computeBasicHtml({ origin }: { origin: string }): string {
    return RELEASES.map(v => `
        <h4 id="${v.id}">${encodeXml(v.title)}</h4>
        ${computeBulletPointsHtml(v.bulletPoints, { origin })}
    `).join('\n\n');
}

const computeReleasesRss = ({ title, origin }: { title: string, origin: string }) => `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${encodeXml(title)}</title>
    <link>${origin}/releases</link>
    <description>Latest releases from the OP3, the Open Podcast Prefix Project</description>
    <language>en-us</language>
    <lastBuildDate>${computeRfc822(RELEASES[0].time)}</lastBuildDate>
    <atom:link href="${origin}/releases.rss" rel="self" type="application/rss+xml" />
${RELEASES.map(v => `
    <item>
      <title>${encodeXml(v.title)}</title>
      <link>${origin}/releases#${v.id}</link>
      <pubDate>${computeRfc822(v.time)}</pubDate>
      <guid>${origin}/releases#${v.id}</guid>
      <description>${computeBulletPointsDescription(v.bulletPoints, { origin })}</description>
      <content:encoded>${encodeXml(computeBulletPointsHtml(v.bulletPoints, { origin }))}</content:encoded>
    </item>  
`)}
  </channel>
</rss>
`