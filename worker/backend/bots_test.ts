import { assert } from '../tests/deps.ts';
import { isBotIpHash } from './bots.ts';

Deno.test({
    name: 'isBotIpHash',
    fn: () => {
        const date = '2025-01-01';
        const referrerType = undefined;
        assert(isBotIpHash({ hashedIpAddress: '5a8ce5c15b702fb94c8684d273ffb51d3c0383c4', agentType: '', agentName: '', asn: '', destinationServerUrl: '', deviceName: '', regionCode: '', date, referrerType }));
        assert(!isBotIpHash({ hashedIpAddress: '5a8ce5c15b702fb94c8684d273ffb51d3c0383c3', agentType: '', agentName: '', asn: '', destinationServerUrl: '', deviceName: '', regionCode: '', date, referrerType }));
   
        assert(isBotIpHash({ hashedIpAddress: 'asdf', agentType: 'browser', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://ondemand.kut.org/fdd/audio/download/kut/kut-news-now/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'TX', date, referrerType }));
        assert(!isBotIpHash({ hashedIpAddress: 'asdf', agentType: 'browser', agentName: 'Chrome', asn: '16590', destinationServerUrl: 'https://ondemand.kut.org/fdd/audio/download/kut/kut-news-now/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'TX', date, referrerType }));
        assert(!isBotIpHash({ hashedIpAddress: 'asdf', agentType: 'browser', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://example.com/fdd/audio/download/kut/kut-news-now/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'TX', date, referrerType }));
        assert(!isBotIpHash({ hashedIpAddress: 'asdf', agentType: 'browser', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://ondemand.kut.org/fdd/audio/download/kut/another/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'TX', date, referrerType }));
        assert(!isBotIpHash({ hashedIpAddress: 'asdf', agentType: 'browser', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://ondemand.kut.org/fdd/audio/download/kut/kut-news-now/20250124_KNN_PM.mp3?awCollectionId=gKeijBW&awEpisodeId=20250124_KNN_PM&ignore=mc.blubrry.com', deviceName: 'Windows Computer', regionCode: 'OH', date, referrerType }));
        assert(!isBotIpHash({ hashedIpAddress: 'asdf', agentType: 'browser', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://redirect.zencastr.com/r/episode/6a46c9b101c30d6740b24f27/size/89382626/video-files/679ceb1787082444de3f8c68/409d1d7e-7551-47c5-899c-4fbd765b71da.mp4', deviceName: 'Windows Computer', regionCode: 'OH', date, referrerType }));
        assert(isBotIpHash({ hashedIpAddress: 'asdf', agentType: 'browser', agentName: 'Chrome', asn: '16591', destinationServerUrl: 'https://redirect.zencastr.com/r/episode/6a46c9b101c30d6740b24f27/size/89382626/video-files/679ceb1787082444de3f8c68/409d1d7e-7551-47c5-899c-4fbd765b71da.mp4', deviceName: 'Windows Computer', regionCode: 'OH', date: '2026-08-23', referrerType }));

    }
});
