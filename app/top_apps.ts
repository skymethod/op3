import { makeTopBox } from './top_box.ts';
import { computeAppDownloads } from '../worker/routes/api_shared.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, strings: Record<string, string>, lang: string | undefined };

export const makeTopApps = ({ showSlug, monthlyDimensionDownloads, strings, lang }: Opts) => {
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
        strings,
        lang,
    });
};
