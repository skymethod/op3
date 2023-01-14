export interface Stats {
    readonly asof: string; // date
    readonly dailyDownloads: Record<string, number>; // date -> downloads
    readonly dimensionDownloads: Record<string, Record<string, number>>; // dimension -> value -> downloads
}
