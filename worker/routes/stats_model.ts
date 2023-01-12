export interface Stats {
    readonly asof: string; // date
    readonly dailyDownloads: Record<string, number>; // date -> downloads
}
