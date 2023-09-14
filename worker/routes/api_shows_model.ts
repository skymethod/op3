
export interface ApiShowsResponse {
    readonly showUuid: string;
    readonly title?: string;
    readonly podcastGuid?: string;
    readonly statsPageUrl: string;
    readonly episodes?: readonly EpisodeInfo[];
}

export type EpisodeInfo = { readonly id: string, readonly title?: string, readonly pubdate?: string };

export interface ApiShowStatsResponse {
    readonly showUuid: string;
    readonly months: string[];
    readonly episodeFirstHours: Record<string, string>;
    readonly hourlyDownloads: Record<string, number>;
    readonly episodeHourlyDownloads: Record<string, Record<string, number>>;
    readonly dailyFoundAudience: Record<string, number>;
    readonly monthlyDimensionDownloads: Record<string, Record<string, Record<string, number>>>;
}

export interface ApiShowSummaryStatsResponse {
    readonly showUuid: string;
    readonly lastCalendarMonth?: string;
    readonly lastCalendarMonthDownloads?: number;
    readonly lastCalendarMonthAudience?: number;
    readonly times?: Record<string, number>;
}
