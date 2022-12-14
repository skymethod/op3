
export interface ApiShowsResponse {
    readonly showUuid: string;
    readonly title?: string;
    readonly episodes: readonly EpisodeInfo[];
}

export type EpisodeInfo = { readonly id: string, readonly title?: string, readonly pubdate?: string };

export interface ApiShowStatsResponse {
    readonly showUuid: string;
    readonly episodeFirstHours: Record<string, string>;
    readonly hourlyDownloads: Record<string, number>;
    readonly episodeHourlyDownloads: Record<string, Record<string, number>>;
    readonly dailyFoundAudience: Record<string, number>;
    readonly monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>;

}
