import { assertEquals } from './tests/deps.ts';
import { computeChainDestinationHostname, computeChainEstimate, normalizeOrigin } from './chain_estimate.ts';

Deno.test({
    name: 'computeChainEstimate',
    fn: () => {
        assertEquals(computeChainEstimate('asdf'), [{ kind: 'destination', url: 'asdf' } ]);
        assertEquals(computeChainEstimate('https://a.com/path/to/episode.mp3'), [{ kind: 'destination', url: 'https://a.com/path/to/episode.mp3' } ]);
        assertEquals(computeChainEstimate('https://op3.dev/e/a.com/path/to/episode.mp3'), [{ kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/a.com/path/to/episode.mp3' }, { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' } ]);
        assertEquals(computeChainEstimate('https://op3.dev/e,pg=asdf/a.com/path/to/episode.mp3'), [{ kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e,pg=asdf/a.com/path/to/episode.mp3' }, { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' } ]);
        assertEquals(computeChainEstimate('https://dts.podtrac.com/redirect.mp3/pdst.fm/e/chrt.fm/track/CHRT123/pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3'),
        [
            { kind: 'prefix', prefix: 'podtrac', url: 'https://dts.podtrac.com/redirect.mp3/pdst.fm/e/chrt.fm/track/CHRT123/pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' },
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/chrt.fm/track/CHRT123/pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' },
            { kind: 'prefix', prefix: 'chartable', url: 'https://chrt.fm/track/CHRT123/pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' },
            { kind: 'prefix', prefix: 'veritonic', url: 'https://pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' },
            { kind: 'prefix', prefix: 'artsai', url: 'https://arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' },
            { kind: 'destination', url: 'https://sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' },
        ]);
        assertEquals(computeChainEstimate('https://op3.dev/e/http://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/http://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://pdst.fm/e/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podsights', url: 'http://pdst.fm/e/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://chrt.fm/track/CHRT123/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'chartable', url: 'http://chrt.fm/track/CHRT123/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://pdcn.co/e/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podcorn', url: 'https://pdcn.co/e/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://2.gum.fm/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'gumball', url: 'https://2.gum.fm/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/chtbl.com/track/12345/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/chtbl.com/track/12345/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'chartable', url: 'https://chtbl.com/track/12345/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://op3.dev/e/a.com/path/to/episode.mp3?aid=rss_feed&feed=asdf'), [
            { kind: 'prefix', prefix: 'op3', url: 'http://op3.dev/e/a.com/path/to/episode.mp3?aid=rss_feed&feed=asdf' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3?aid=rss_feed&feed=asdf' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev:443/e/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://op3.dev:80/e/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'http://op3.dev/e/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' } // for now, we redirect to https in this case
        ]);

        assertEquals(computeChainEstimate('https://pdst.fm/e/verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podscribe', url: 'https://verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://s.gum.fm/r1/00007200924c300d57a5ffff/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'gumball', url: 'https://s.gum.fm/r1/00007200924c300d57a5ffff/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://Op3.dev/e/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://claritaspod.com/measure/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'claritas', url: 'https://claritaspod.com/measure/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://claritaspod.com/measure/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'claritas', url: 'http://claritaspod.com/measure/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/pdcn.co/e/growx.podkite.com/https/D3E76IU7/pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/pdcn.co/e/growx.podkite.com/https/D3E76IU7/pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podcorn', url: 'https://pdcn.co/e/growx.podkite.com/https/D3E76IU7/pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podkite', url: 'https://growx.podkite.com/https/D3E76IU7/pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podtrac', url: 'https://dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://growx.podkite.com/http/D3E76IU7/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podkite', url: 'https://growx.podkite.com/http/D3E76IU7/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://media.blubrry.com/something/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'blubrry', url: 'https://media.blubrry.com/something/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://media.blubrry.com/something/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'blubrry', url: 'http://media.blubrry.com/something/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://chrt.fm/track/ABC123/https://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'chartable', url: 'https://chrt.fm/track/ABC123/https://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://pdcn.co/e/https://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podcorn', url: 'https://pdcn.co/e/https://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://www.podtrac.com/pts/redirect.mp3/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podtrac', url: 'https://www.podtrac.com/pts/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/http://dts.podtrac.com/redirect.mp3/http://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/http://dts.podtrac.com/redirect.mp3/http://a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podtrac', url: 'http://dts.podtrac.com/redirect.mp3/http://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://mgln.ai/track/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'magellan', url: 'https://mgln.ai/track/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://mgln.ai/track/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'magellan', url: 'http://mgln.ai/track/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://mgln.ai/track/http://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'magellan', url: 'https://mgln.ai/track/http://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://mgln.ai/e/256/https://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'magellan', url: 'https://mgln.ai/e/256/https://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://mgln.ai/e/p609310/https://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'magellan', url: 'https://mgln.ai/e/p609310/https://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://mgln.ai/e/89/https://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'magellan', url: 'https://mgln.ai/e/89/https://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://p.podderapp.com/1234567890/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podder', url: 'https://p.podderapp.com/1234567890/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://p.podderapp.com/1234567890/http://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podder', url: 'https://p.podderapp.com/1234567890/http://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://r.zen.ai/r/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'zencastr', url: 'https://r.zen.ai/r/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://r.zen.ai/r/http://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'zencastr', url: 'http://r.zen.ai/r/http://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/chrt.fm/track/12345/https:/verifi.podscribe.com/rss/p/traffic.megaphone.fm/episode.mp3?updated=1668088535'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/chrt.fm/track/12345/https:/verifi.podscribe.com/rss/p/traffic.megaphone.fm/episode.mp3?updated=1668088535' },
            { kind: 'prefix', prefix: 'chartable', url: 'https://chrt.fm/track/12345/https:/verifi.podscribe.com/rss/p/traffic.megaphone.fm/episode.mp3?updated=1668088535' },
            { kind: 'prefix', prefix: 'podscribe', url: 'https://verifi.podscribe.com/rss/p/traffic.megaphone.fm/episode.mp3?updated=1668088535' },
            { kind: 'destination', url: 'https://traffic.megaphone.fm/episode.mp3?updated=1668088535' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/https://chtbl.com/track/12345/dts.podtrac.com/redirect.m4a/a.com/path/to/episode.m4a'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/https://chtbl.com/track/12345/dts.podtrac.com/redirect.m4a/a.com/path/to/episode.m4a' },
            { kind: 'prefix', prefix: 'chartable', url: 'https://chtbl.com/track/12345/dts.podtrac.com/redirect.m4a/a.com/path/to/episode.m4a' },
            { kind: 'prefix', prefix: 'podtrac', url: 'https://dts.podtrac.com/redirect.m4a/a.com/path/to/episode.m4a' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.m4a' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/https://play.podtrac.com/ABC-Whatever/chrt.fm/track/12345/pdst.fm/e/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/https://play.podtrac.com/ABC-Whatever/chrt.fm/track/12345/pdst.fm/e/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podtrac', url: 'https://play.podtrac.com/ABC-Whatever/chrt.fm/track/12345/pdst.fm/e/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'chartable', url: 'https://chrt.fm/track/12345/pdst.fm/e/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://pdst.fm/e/a.com%2Fpath%2Fto%2Fepisode.mp3?a=%2F'), [
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/a.com%2Fpath%2Fto%2Fepisode.mp3?a=%2F' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3?a=%2F' }
        ]);

        assertEquals(computeChainEstimate('https://pdst.fm/e/a.com%2Fpath%2Fto%2Fepisode.mp3?'), [
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/a.com%2Fpath%2Fto%2Fepisode.mp3?' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://www.podtrac.com/pts/redirect.mp3/pdst.fm/e/arttrk.com/p/ABCD1/pscrb.fm/rss/p/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podtrac', url: 'https://www.podtrac.com/pts/redirect.mp3/pdst.fm/e/arttrk.com/p/ABCD1/pscrb.fm/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/arttrk.com/p/ABCD1/pscrb.fm/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'artsai', url: 'https://arttrk.com/p/ABCD1/pscrb.fm/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podscribe', url: 'https://pscrb.fm/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/pdcn.co/e/p.podderapp.com/1234567890/growx.podkite.com/https/ABCDabWXYZ/pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/pdcn.co/e/p.podderapp.com/1234567890/growx.podkite.com/https/ABCDabWXYZ/pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podcorn', url: 'https://pdcn.co/e/p.podderapp.com/1234567890/growx.podkite.com/https/ABCDabWXYZ/pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podder', url: 'https://p.podderapp.com/1234567890/growx.podkite.com/https/ABCDabWXYZ/pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podkite', url: 'https://growx.podkite.com/https/ABCDabWXYZ/pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podtrac', url: 'https://dts.podtrac.com/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://t.glystn.com/v2/track/PID-1234abcd/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'glystn', url: 'https://t.glystn.com/v2/track/PID-1234abcd/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://t.glystn.com/v2/track/PID-1234abcd/http://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'glystn', url: 'https://t.glystn.com/v2/track/PID-1234abcd/http://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://adbarker.com/stream/asdfASDf1345asdfASDf1345/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'adbarker', url: 'https://adbarker.com/stream/asdfASDf1345asdfASDf1345/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://adbarker.com/stream/asdfASDf1345asdfASDf1345/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'adbarker', url: 'http://adbarker.com/stream/asdfASDf1345asdfASDf1345/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://adbarker.com/stream/asdfASDf1345asdfASDf1345/https://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'adbarker', url: 'http://adbarker.com/stream/asdfASDf1345asdfASDf1345/https://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://letscast.fm/track/https://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'letscast', url: 'https://letscast.fm/track/https://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://letscast.fm/track/https:/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'letscast', url: 'https://letscast.fm/track/https:/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://media.blubrry.com/asdf/p/media.blubrry.com/asdf/p/www.podtrac.com/pts/redirect.mp3/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'blubrry', url: 'http://media.blubrry.com/asdf/p/media.blubrry.com/asdf/p/www.podtrac.com/pts/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'blubrry', url: 'http://media.blubrry.com/asdf/p/www.podtrac.com/pts/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podtrac', url: 'http://www.podtrac.com/pts/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/chrt.fm/track/123ABC/https%3A//verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/chrt.fm/track/123ABC/https%3A//verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'chartable', url: 'https://chrt.fm/track/123ABC/https%3A//verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podscribe', url: 'https://verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://www.podtrac.com/pts/redirect.mp3/pdst.fm/e/pfx.vpixl.com/12xyZ/arttrk.com/p/AZ123/chtbl.com/track/AZ123/verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podtrac', url: 'https://www.podtrac.com/pts/redirect.mp3/pdst.fm/e/pfx.vpixl.com/12xyZ/arttrk.com/p/AZ123/chtbl.com/track/AZ123/verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/pfx.vpixl.com/12xyZ/arttrk.com/p/AZ123/chtbl.com/track/AZ123/verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'vpixl', url: 'https://pfx.vpixl.com/12xyZ/arttrk.com/p/AZ123/chtbl.com/track/AZ123/verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'artsai', url: 'https://arttrk.com/p/AZ123/chtbl.com/track/AZ123/verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'chartable', url: 'https://chtbl.com/track/AZ123/verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podscribe', url: 'https://verifi.podscribe.com/rss/p/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://bktrks.co/t/1234abcd1234abcd/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'backtracks', url: 'https://bktrks.co/t/1234abcd1234abcd/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://pdrl.fm/123abc/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podroll', url: 'https://pdrl.fm/123abc/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/chrt.fm/track/123ABC/https://verifi.podscribe.com/rss/p/https://a.pdcst.to/KyUg65GkT5REkp0z/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/chrt.fm/track/123ABC/https://verifi.podscribe.com/rss/p/https://a.pdcst.to/KyUg65GkT5REkp0z/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'chartable', url: 'https://chrt.fm/track/123ABC/https://verifi.podscribe.com/rss/p/https://a.pdcst.to/KyUg65GkT5REkp0z/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'podscribe', url: 'https://verifi.podscribe.com/rss/p/https://a.pdcst.to/KyUg65GkT5REkp0z/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'voxalyze', url: 'https://a.pdcst.to/KyUg65GkT5REkp0z/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://podtrac.com/pts/redirect.mp3/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'podtrac', url: 'https://podtrac.com/pts/redirect.mp3/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://op3.dev/e/s.gum.fm/s-123456abcdef123456abcdef/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/s.gum.fm/s-123456abcdef123456abcdef/a.com/path/to/episode.mp3' },
            { kind: 'prefix', prefix: 'gumball', url: 'https://s.gum.fm/s-123456abcdef123456abcdef/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://prfx.byspotify.com/e/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'spotify', url: 'https://prfx.byspotify.com/e/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://prfx.byspotify.com/e/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'spotify', url: 'http://prfx.byspotify.com/e/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('https://prfx.byspotify.com/e/http://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'spotify', url: 'https://prfx.byspotify.com/e/http://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'http://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://prfx.byspotify.com/e/https://a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'spotify', url: 'http://prfx.byspotify.com/e/https://a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

        assertEquals(computeChainEstimate('http://prfx.byspotify.com/e/https:/a.com/path/to/episode.mp3'), [
            { kind: 'prefix', prefix: 'spotify', url: 'http://prfx.byspotify.com/e/https:/a.com/path/to/episode.mp3' },
            { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' }
        ]);

    }
});

Deno.test({
    name: 'normalizeOrigin',
    fn: () => {
        const tests = {
            'asdf': 'asdf',
            'httpS://asdf.com': 'https://asdf.com',
            'http://asdf-POW.com': 'http://asdf-pow.com',
            'http://aSdf:8080/path': 'http://asdf:8080/path',
            'http://aSdf.com:80/path': 'http://asdf.com/path',
            'HTTPS://aSdf.com:443/path': 'https://asdf.com/path',
        }
        for (const [ input, expectedOutput ] of Object.entries(tests)) {
            assertEquals(normalizeOrigin(input), expectedOutput);
        }
    }
});

Deno.test({
    name: 'computeChainDestinationHostname',
    fn: () => {

        const tests = {
            'https://op3.dev/e/pdcn.co/e/example.com/foo': 'example.com',
            'https://op3.dev/e/pdcn.co/e/example.com%2Ffoo': undefined,
        }
        for (const [ input, expectedOutput ] of Object.entries(tests)) {
            assertEquals(computeChainDestinationHostname(input, { urlDecodeIfNecessary: false }), expectedOutput);
        }

        const testsWithUrlDecode = {
            'https://op3.dev/e/pdcn.co/e/example.com/foo': 'example.com',
            'https://op3.dev/e/pdcn.co/e/example.com%2Ffoo': 'example.com',
           
        }
        for (const [ input, expectedOutput ] of Object.entries(testsWithUrlDecode)) {
            assertEquals(computeChainDestinationHostname(input, { urlDecodeIfNecessary: true }), expectedOutput);
        }
    }
});
