import { isStringRecord } from '../check.ts';

export interface RecentEpisodes {
    readonly asof: string;
    readonly episodes: readonly EpisodeInfo[];
}

export function isValidRecentEpisodes(obj: unknown): obj is RecentEpisodes {
    return isStringRecord(obj)
        && typeof obj.asof === 'string'
        && Array.isArray(obj.episodes) && obj.episodes.every(isValidEpisodeInfo)
        ;
}

export interface EpisodeInfo {
    readonly pubdate: string;
    readonly podcastGuid: string;
    readonly episodeItemGuid: string;
    readonly hasTranscripts?: boolean;
    readonly dailyDownloads: Record<string, number>;
}

export function isValidEpisodeInfo(obj: unknown): obj is EpisodeInfo {
    return isStringRecord(obj)
        && typeof obj.pubdate === 'string'
        && typeof obj.podcastGuid === 'string'
        && typeof obj.episodeItemGuid === 'string'
        && (obj.hasTranscripts === undefined || typeof obj.hasTranscripts === 'boolean')
        && isStringRecord(obj.dailyDownloads)
        ;
}
