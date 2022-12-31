import { makeTopBox } from './top_box.ts';
import { checkMatches } from '../worker/check.ts';
import { increment } from '../worker/summaries.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> };

export const makeTopBrowserDownloads = ({ showSlug, monthlyDimensionDownloads }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, computeBrowserDownloads(v)]));

    const computeDownloadsForMonth = (month: string) => Object.values(monthlyDimensionDownloads[month]['countryCode']).reduce((a, b) => a + b, 0);
    return makeTopBox({
        type: 'browser-and-referrers',
        showSlug,
        exportId: 'top-browser-downloads-export',
        previousId: 'top-browser-downloads-month-previous',
        nextId: 'top-browser-downloads-month-next',
        monthId: 'top-browser-downloads-month',
        listId: 'top-browser-downloads',
        templateId: 'top-browser-downloads-row',
        monthlyDownloads,
        downloadsDenominator: computeDownloadsForMonth,
        tsvHeaderNames: [ 'browserOrReferrer' ],
        computeName: key => key,
    });
};

//

function computeBrowserDownloads(dimensionDownloads: Record<string, Record<string, number>>):  Record<string, number> {
    const rt = dimensionDownloads['browserName'] ?? {};

    const referrers = dimensionDownloads['referrer'] ?? {};
    for (const [ referrer, downloads ] of Object.entries(referrers)) {
        const [ _, type, name ] = checkMatches('referrer', referrer, /^([a-z]+)\.(.*?)$/);
        if (type === 'app') {
            increment(rt, name, downloads);
        } else if (type === 'domain') {
            if (name.startsWith('unknown:')) {
                increment(rt, 'Unknown', downloads);
            } else if (name.includes(' ')) {
                increment(rt, name, downloads);
            } else {
                increment(rt, `https://${name}`, downloads);
            }
        } else if (type === 'host') {
            increment(rt, name, downloads);
        } else {
            console.warn(`Unsupported referrer type: ${type}`);
        }
    }

    delete rt['Unknown']; // no value here

    return rt;
}
