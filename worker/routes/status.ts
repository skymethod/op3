import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet } from './html.ts';
import { computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';
import { newMethodNotAllowedResponse, newRssResponse } from '../responses.ts';
import { FeedItem, computeBasicHtml, computeRss, tryParseFeedRequest } from './feed.ts';
import { RpcClient } from '../rpc_model.ts';
const statusHtm = await importText(import.meta.url, '../static/status.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function tryParseStatusRequest(opts: { method: string, pathname: string, headers: Headers}): StatusRequest | undefined {
    return tryParseFeedRequest({ ...opts, expectedPath: 'status' });
}

export function computeStatusResponse({ method, type } : StatusRequest, { instance, origin, productionOrigin, cfAnalyticsToken }: { instance: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined, rpcClient: RpcClient }): Response {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    const titleSuffix = instance === 'prod' ? '' : ` (${instance})`;
    const title = `Status · OP3${titleSuffix}: The Open Podcast Prefix Project`;
    const description = `Latest status from OP3, the Open Podcast Prefix Project`;
    const items = ITEMS;

    if (type === 'rss') return newRssResponse(computeRss({ items, title, description, origin, pathname: '/status' }));

    const html = computeHtml(statusHtm, {
        title,
        styleTag: `<style>\n${outputCss}\n</style>`,
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        basicHtml: computeBasicHtml({ items, origin }),
        coloMonitorBasicHtml: '(no backlog, everything up to date)',
        origin,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}

//

export interface StatusRequest {
    readonly method: string;
    readonly type: 'html' | 'rss';
}

//

const ITEMS: FeedItem[] = [
    {
        id: '2023-12-15-2023-12-21-finished',
        time: '2023-12-21T16:42:19.061Z',
        title: '2023-12-15: Reprocessing from mid-October (done 2023-12-21)',
        bulletPoints: [
            () => `We've just noticed that data from three large incoming colos (IAD, ATL, & MIA) have not been included in the processing pipeline for several weeks: IAD since 10/10, ATL since 10/14, MIA since 11/03.  Nothing has been lost, but we now have a potentially large amount of unexpected data to reprocess and recompute.`,
            ({ origin }) => `First, we'll need to process the 'hits' ([redirect logs](${origin}/api/docs#tag/redirect-logs)) coming in from each of the three colos.  We're starting with MIA, since it's the least backed up, then we'll process IAD and ATL. This is likely to take several days, as it competes with continuous live data coming in at the same time from all colos.  See the colo monitor below to track this process live. **(This is now complete)**`,
            ({ origin }) => `Once all colos are up to date, we'll need to [recompute downloads](${origin}/download-calculation) for all shows based on the underlying hits, starting from 10/10 up to the present. This will probably take several hours. **(This is now complete)**`,
            () => `It's likely that download numbers currently shown for most shows are a bit lower than they should be, starting from the middle of October.  The numbers will be up to date and comprehensive again once this process completes.  No data has been lost, just delayed. **(This is now complete)**`,
            ({ origin }) => `Sorry about the delay: OP3 will always report issues like this as soon as they come up since we are committed to transparency – not only in data and codebase, but also in operations and [costs](${origin}/costs).`,
            () => `Subscribe to this page (RSS link above) to follow the updates as we catch up.`,
            () => `[2023-12-21]: Finished - all shows have been fully reprocessed.`
        ]
    },
];
