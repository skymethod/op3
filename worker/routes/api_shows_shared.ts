import { checkMatches } from '../check.ts';
import { increment } from '../summaries.ts';

export function computeAppDownloads(dimensionDownloads: Record<string, Record<string, number>>):  Record<string, number> {
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
