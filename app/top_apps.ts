import { makeTopBox } from './top_box.ts';

type Opts = { monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> };

export const makeTopApps = ({ monthlyDimensionDownloads }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['appName'] ?? {}]));

    return makeTopBox({
        type: 'apps',
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
