import { assertEquals, fail } from './tests/deps.ts';
import { ApplePodcastsUserAgent, parseApplePodcastsUserAgent } from './apple_podcasts_ua.ts';

Deno.test({
    name: 'parseApplePodcastsUserAgent',
    fn: () => {

        const good: Record<string, ApplePodcastsUserAgent> = {
            'Podcasts/4023.510.2 CFNetwork/1494.0.7 Darwin/23.4.0': { appName: 'Podcasts', appVersion: '4023.0510.0002.0000', cfVersion: '1494.0000.0007.0000', dwVersion: '0023.0004.0000.0000', trailer: undefined },
        };
        for (const [ userAgent, expected ] of Object.entries(good)) {
            const result = parseApplePodcastsUserAgent(userAgent);
            if (!result) fail(userAgent);
            assertEquals(result.appName, expected.appName);
            assertEquals(result.appVersion, expected.appVersion);
            assertEquals(result.cfVersion, expected.cfVersion);
            assertEquals(result.dwVersion, expected.dwVersion);
            assertEquals(result.trailer, expected.trailer);
        }

        const bad = [
            'Podcasts/1530.3 (iPad; iOS 17.4; Scale/1.00)',
            'Podcasts/1530.3 (iPhone; iOS 17.4.1; Scale/2.00)',
            'Podcasts/3.5.1 (app.podcast.cosmos; build:402; iOS 16.2.0) Alamofire/5.0.0-rc.3',
            'Podcast/1.7.3 (Linux;Android 13) ExoPlayerLib/2.10.4',
            'Podcasts/3.9 iOS/17.2.1 model/iPhone12,3 hwp/t8030 build/21C66 (6; dt:205) AMS/1',
        ];
        for (const userAgent of bad) {
            assertEquals(parseApplePodcastsUserAgent(userAgent), undefined);
        }
    }
});
