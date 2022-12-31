import { makeTopBox } from './top_box.ts';
import { checkMatches } from '../worker/check.ts';
import { increment } from '../worker/summaries.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> };

export const makeTopApps = ({ showSlug, monthlyDimensionDownloads }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, computeAppDownloads(v)]));

    return makeTopBox({
        type: 'apps',
        showSlug,
        exportId: 'top-apps-export',
        previousId: 'top-apps-month-previous',
        nextId: 'top-apps-month-next',
        monthId: 'top-apps-month',
        listId: 'top-apps',
        templateId: 'top-apps-row',
        monthlyDownloads,
        tsvHeaderNames: [ 'app' ],
        computeName: key => key,
    });
};

//

function computeAppDownloads(dimensionDownloads: Record<string, Record<string, number>>):  Record<string, number> {
    const rt = dimensionDownloads['appName'] ?? {};

    const libs = dimensionDownloads['libraryName'] ?? {};
    const appleCoreMedia = libs['AppleCoreMedia'];
    if (appleCoreMedia) rt['Unknown Apple App'] = appleCoreMedia;

    const referrers = dimensionDownloads['referrer'] ?? {};
    for (const [ referrer, downloads ] of Object.entries(referrers)) {
        const [ _, type, name ] = checkMatches('referrer', referrer, /^([a-z]+)\.(.*?)$/);
        if (type === 'app') {
            increment(rt, name, downloads);
        }
    }
    return rt;
}
