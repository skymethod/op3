
export type ApplePodcastsUserAgent = { appName: string, appVersion: string, cfVersion: string, dwVersion: string, trailer: string | undefined };

export function parseApplePodcastsUserAgent(userAgent: string): ApplePodcastsUserAgent | undefined {
    if (/^Podcasts?\/\d{1,4}\.\d(\.\d)?( (\(app\..*?|[^\s]+))?$/.test(userAgent)) return undefined; // Podcasts/3.5.1, Podcasts/1530.3 Podcast/2.2 (app.podcast.cosmos; build:402; iOS 16.2.0) Alamofire/5.0.0-rc.3
    if (/ExoPlayerLib\//.test(userAgent)) return undefined; // Podcast/1.7.3 (Linux;Android 13) ExoPlayerLib/2.10.4
    if (/ model\/.*?hwp\//.test(userAgent)) return undefined; // Podcasts/3.9 iOS/17.2.1 model/iPhone12,3 hwp/t8030 build/21C66 (6; dt:205) AMS/1
    const m = /^([^/\s]+)\/(\d+)(\.(\d+))?(\.(\d+))?(\.(\d+))? CFNetwork\/(\d+)(\.(\d+))?(\.(\d+))?(\.(\d+))? Darwin\/(\d+)\.(\d+)\.(\d+)( (\(x86_64\)( [0-9A-Za-z]{6})?|Opendium|[^\s]+))?$/.exec(userAgent);
    if (!m) throw new Error(`Unsupported Apple Podcasts user-agent: ${userAgent}`);
    const [ _, appName, 
        appVersion1, _appVersion2, appVersion2, _appVersion3, appVersion3, _appVersion4, appVersion4,
        cfVersion1, _cfVersion2, cfVersion2, _cfVersion3, cfVersion3, _cfVersion4, cfVersion4,
        dwVersion1, dwVersion2, dwVersion3,
        _trailer, trailer,
    ] = m;
    const appVersion = `${pad(appVersion1)}.${pad(appVersion2)}.${pad(appVersion3)}.${pad(appVersion4)}`;
    const cfVersion = `${pad(cfVersion1)}.${pad(cfVersion2)}.${pad(cfVersion3)}.${pad(cfVersion4)}`;
    const dwVersion = `${pad(dwVersion1)}.${pad(dwVersion2)}.${pad(dwVersion3)}.${pad()}`;
    return { appName, appVersion, cfVersion, dwVersion, trailer };
}

//

function pad(versionComponent: string | undefined = '0') {
    if (!(versionComponent.length <= 4)) throw new Error(`Bad versionComponent: ${versionComponent}`);
    return versionComponent.padStart(4, '0');
}
