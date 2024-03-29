import { makeTopBox } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>, strings: Record<string, string>, lang: string | undefined };

export const makeTopDevices = ({ showSlug, monthlyDimensionDownloads, strings, lang }: Opts) => {
    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['deviceName'] ?? {} ]));

    return makeTopBox({
        type: 'devices',
        showSlug,
        exportId: 'top-devices-export',
        previousId: 'top-devices-month-previous',
        nextId: 'top-devices-month-next',
        monthId: 'top-devices-month',
        listId: 'top-devices',
        templateId: 'top-devices-row',
        monthlyDownloads,
        tsvHeaderNames: [ 'device' ],
        computeName: key => key,
        strings,
        lang,
    });
};
