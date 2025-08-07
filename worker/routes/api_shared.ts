import { checkMatches } from '../check.ts';
import { increment } from '../summaries.ts';
import { addHoursToHourString } from '../timestamp.ts';

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

export type RelativeSummary = { cumulative: Record<string, number>, downloads1?: number, downloads3?: number, downloads7?: number, downloads30?: number, downloadsAll: number };

export function computeRelativeSummary(hourlyDownloads: Record<string, number>): RelativeSummary {
    const cumulative: Record<string, number> = {};
    let downloads1: number | undefined;
    let downloads3: number | undefined;
    let downloads7: number | undefined;
    let downloads30: number | undefined;
    let hourNum = 1;
    let total = 0;
    for (const [ _hour, downloads ] of Object.entries(hourlyDownloads)) {
        total += downloads;
        if (hourNum <= 24 * 30) { // chart max 30 days
           cumulative[`h${(hourNum++).toString().padStart(4, '0')}`] = total;
        }
        if (hourNum === 1 * 24) downloads1 = total;
        if (hourNum === 3 * 24) downloads3 = total;
        if (hourNum === 7 * 24) downloads7 = total;
        if (hourNum === 30 * 24) downloads30 = total;
    }
    return { cumulative, downloadsAll: total, downloads1, downloads3, downloads7, downloads30 };
}

export function insertZeros(hourlyDownloads: Record<string, number>): Record<string, number> {
    const hours = Object.keys(hourlyDownloads)
    if (hours.length < 2) return hourlyDownloads;
    const maxHour = hours.at(-1)!;
    let hour = hours[0];
    const rt: Record<string, number>  = {};
    while (hour <= maxHour) {
        rt[hour] = hourlyDownloads[hour] ?? 0;
        hour = addHoursToHourString(hour, 1);
    }
    return rt;
}
