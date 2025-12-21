import { assert } from '../tests/deps.ts';
import { isBotIpHash } from './bots.ts';

Deno.test({
    name: 'isBotIpHash',
    fn: () => {
        const date = '2025-01-01';
        assert(isBotIpHash({ hashedIpAddress: '5a8ce5c15b702fb94c8684d273ffb51d3c0383c4', agentName: '', asn: '', destinationServerUrl: '', deviceName: '', regionCode: '', date }));
        assert(!isBotIpHash({ hashedIpAddress: '5a8ce5c15b702fb94c8684d273ffb51d3c0383c3', agentName: '', asn: '', destinationServerUrl: '', deviceName: '', regionCode: '', date }));
   
        assert(isBotIpHash({ hashedIpAddress: 'asdf', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://ondemand.kut.org/fdd/audio/download/kut/kut-news-now/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'TX', date }));
        assert(!isBotIpHash({ hashedIpAddress: 'asdf', agentName: 'Chrome', asn: '16590', destinationServerUrl: 'https://ondemand.kut.org/fdd/audio/download/kut/kut-news-now/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'TX', date }));
        assert(!isBotIpHash({ hashedIpAddress: 'asdf', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://example.com/fdd/audio/download/kut/kut-news-now/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'TX', date }));
        assert(!isBotIpHash({ hashedIpAddress: 'asdf', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://ondemand.kut.org/fdd/audio/download/kut/another/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'TX', date }));
        assert(!isBotIpHash({ hashedIpAddress: 'asdf', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://ondemand.kut.org/fdd/audio/download/kut/kut-news-now/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'OH', date }));

    }
});
