import { assertEquals, fail } from './tests/deps.ts';
import { ApplePodcastsUserAgent, parseApplePodcastsUserAgent } from './apple_podcasts_ua.ts';

Deno.test({
    name: 'parseApplePodcastsUserAgent',
    fn: () => {

        const good: Record<string, ApplePodcastsUserAgent> = {
            'Podcasts/4023.510.2 CFNetwork/1494.0.7 Darwin/23.4.0': { appName: 'Podcasts', appVersion: '4023.0510.0002.0000', cfVersion: '1494.0000.0007.0000', dwVersion: '0023.0004.0000.0000', trailer: undefined, cfVersionExtra: undefined },
            'Podcasts/4027.200.9 CFNetwork/3896.100.1.3.1 Darwin/27.2.0': { appName: 'Podcasts', appVersion: '4027.0200.0009.0000', cfVersion: '3896.0100.0001.0003', dwVersion: '0027.0002.0000.0000', trailer: undefined, cfVersionExtra: '0001' },
            'Podcasts/4025.300.9 CFNetwork/3860.300.21 Darwin/25.2.0 [client-ip-hash:foo country:foo city:foo region:foo metro:foo]': { appName: 'Podcasts', appVersion: '4025.0300.0009.0000', cfVersion: '3860.0300.0021.0000', dwVersion: '0025.0002.0000.0000', trailer: '[client-ip-hash:foo country:foo city:foo region:foo metro:foo]', cfVersionExtra: undefined },
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
            'Podcasts/2.4 [client-ip-hash:foo]',
            'Podcasty/13.12.2023Ad',
            'Podcasts/1.0 (Apple Inc.; iOS 19.0)',
            'Podcast/0.1.0 linux Linux 6.8.0-110-generic #110-Ubuntu SMP PREEMPT_DYNAMIC Thu Mar 19 15:09:20 UTC 2026',
            'Podcasts/1.0 (FlickFlack Audio Pipeline)',
            'Podcasts/1.0 (iPhone; iOS 18.0) AppleCoreMedia/1.0.0',
            'Podcasts/1.0 (Android RSS podcast player)',
            'Podcast/1.0 (iOS; personal podcast player)',
            'Podcast/0.4 (master project; Ktor)',
            'Podcast/0.5 (Android; master project)',
            'Podcaster/1.0 (Android)',
            'Podcasts/1.0 (a personal podcast app; one listener)',
            'Podcasts/1.1.0 (Golden Gate; Linux)',
            'Podcaster/1.0 (Android; com.podcaster.app)',
            'Podcasts/1.0 CFNetwork AppleCoreMedia',
            'Podcasts/1.1.0 (iPhone; iOS 18.1)',
            'Podcasts/0.5.1 (self-hosted podcast server)',
        ];
        for (const userAgent of bad) {
            assertEquals(parseApplePodcastsUserAgent(userAgent), undefined);
        }
    }
});
