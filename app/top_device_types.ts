import { makeTopBox } from './top_box.ts';

type Opts = { showSlug: string, monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>> };

export const makeTopDeviceTypes = ({ showSlug, monthlyDimensionDownloads }: Opts) => {

    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v]) => [n, v['deviceType'] ?? {} ]));

    return makeTopBox({
        type: 'device-types',
        showSlug,
        exportId: 'top-device-types-export',
        previousId: 'top-device-types-month-previous',
        nextId: 'top-device-types-month-next',
        monthId: 'top-device-types-month',
        listId: 'top-device-types',
        templateId: 'top-device-types-row',
        monthlyDownloads,
        tsvHeaderNames: [ 'deviceType' ],
        computeEmoji,
        computeName: computeDeviceTypeName,
    });
};

//

function computeDeviceTypeName(deviceType: string): string {
    return deviceType.split('_').map(v => v === 'tv' ? 'TV' : v.substring(0, 1).toUpperCase() + v.substring(1)).join(' ');
}

function computeEmoji(deviceType: string): string {
    return {
        mobile: '📱',
        smart_tv: '📺',
        computer: '💻',
        smart_speaker: '🔊',
        watch: '⌚️',
    }[deviceType] ?? '❔';
}
