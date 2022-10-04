import { assertEquals } from './tests/deps.ts';
import { computeChainEstimate, normalizeOrigin } from './chain_estimate.ts';

Deno.test({
    name: 'computeChainEstimate',
    fn: () => {
        assertEquals(computeChainEstimate('asdf'), [{ kind: 'destination', url: 'asdf' } ]);
        assertEquals(computeChainEstimate('https://a.com/path/to/episode.mp3'), [{ kind: 'destination', url: 'https://a.com/path/to/episode.mp3' } ]);
        assertEquals(computeChainEstimate('https://op3.dev/e/a.com/path/to/episode.mp3'), [{ kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/a.com/path/to/episode.mp3' }, { kind: 'destination', url: 'https://a.com/path/to/episode.mp3' } ]);
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
