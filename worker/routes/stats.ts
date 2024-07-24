import { timed } from '../async.ts';
import { Blobs } from '../backend/blobs.ts';
import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml, computeShoelaceCommon, computeStyleTag } from './html.ts';
import { computeNonProdHeader } from './instances.ts';
import { appJs } from './static.ts';
import { Stats } from './stats_model.ts';

const statsHtm = await importText(import.meta.url, '../static/stats.htm');

type Opts = { searchParams: URLSearchParams, instance: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined, statsBlobs: Blobs | undefined, roStatsBlobs: Blobs | undefined };

export async function computeStatsResponse(opts: Opts): Promise<Response> {
    const { searchParams, instance, origin, productionOrigin, cfAnalyticsToken, statsBlobs, roStatsBlobs } = opts;

    const start = Date.now();

    const targetStatsBlobs = searchParams.has('ro') ? roStatsBlobs : statsBlobs;
    if (!targetStatsBlobs) throw new Error(`Need statsBlobs`);
    
    const times: Record<string, number> = {};

    const statsObj = await timed(times, 'get-stats', () => targetStatsBlobs.get('stats/global/current.json', 'json')) as Stats;

    times.compute = Date.now() - start;

    const initialData = JSON.stringify({ statsObj, times });

    const html = computeHtml(statsHtm, {
        initialData,
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: computeStyleTag(),
        shoelaceCommon: computeShoelaceCommon('sl-card', 'sl-spinner', 'sl-icon-button', 'sl-button-group', 'sl-button', 'sl-dropdown', 'sl-menu', 'sl-menu-item', 'sl-switch', 'sl-icon', 'sl-relative-time'),
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        origin,
        appJs,
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}
