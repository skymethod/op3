import { isStringRecord } from '../check.ts';

// minuteMap: [ 60, 1, 1, 0, 0, ... ]
// packedMinuteMap: '60|1100...'

export function packMinuteMap(minuteMap: number[]): string {
    return minuteMap.map(v => v.toString()).join('');
}

export function unpackMinuteMap(packed: string): number[] {
    return [...packed].map(v => v === '1' ? 1 : 0);
}

export function tryUnpackMinuteMap(packed: string): number[] | undefined {
    try {
        return unpackMinuteMap(packed);
    } catch {
        return undefined;
    }
}

export function isValidUnpackedMinuteMap(obj: unknown): obj is number[] {
    return Array.isArray(obj) && obj.length > 0 && obj.every(v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1);
}

export function isValidPackedMinuteMap(obj: unknown): obj is string {
    return typeof obj === 'string' && tryUnpackMinuteMap(obj) !== undefined;
}

export interface EpisodeListenStats {
    readonly itemGuid: string;
    readonly minuteMaps: string[];
}

export function isValidEpisodeListenStats(obj: unknown): obj is EpisodeListenStats {
    return isStringRecord(obj)
        && typeof obj.itemGuid === 'string'
        && Array.isArray(obj.minuteMaps) && obj.minuteMaps.every(isValidPackedMinuteMap)
        ;
}

export interface ShowListenStats {
    readonly showUuid: string;
    readonly episodeListenStats: Record<string, EpisodeListenStats>;
}

export function isValidShowListenStats(obj: unknown): obj is ShowListenStats {
    return isStringRecord(obj)
        && typeof obj.showUuid === 'string'
        && isStringRecord(obj.episodeListenStats) && Object.values(obj.episodeListenStats).every(isValidEpisodeListenStats)
        ;
}

export function computeShowListenStatsKey({ showUuid }: { showUuid: string }): string {
    return `listens/show/${showUuid}/${showUuid}.listen-stats.json`;
}
