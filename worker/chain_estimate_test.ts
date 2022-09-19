import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { computeChainEstimate } from './chain_estimate.ts';

Deno.test({
    name: 'computeChainEstimate',
    fn: () => {
        assertEquals(computeChainEstimate('asdf'), [{ kind: 'destination', url: 'asdf' } ]);
        assertEquals(computeChainEstimate('https://a.com/path/to/episode.mp3'), [{ kind: 'destination', url: 'https://a.com/path/to/episode.mp3' } ]);
        assertEquals(computeChainEstimate('https://op3.dev/e/a.com/path/to/episode.mp3'), [{ kind: 'prefix', prefix: 'op3', url: 'https://op3.dev/e/a.com/path/to/episode.mp3'}, { kind: 'destination', url: 'https://a.com/path/to/episode.mp3'} ]);
        assertEquals(computeChainEstimate('https://dts.podtrac.com/redirect.mp3/pdst.fm/e/chrt.fm/track/CHRT123/pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3'), 
        [
            { kind: 'prefix', prefix: 'podtrac', url: 'https://dts.podtrac.com/redirect.mp3/pdst.fm/e/chrt.fm/track/CHRT123/pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' }, 
            { kind: 'prefix', prefix: 'podsights', url: 'https://pdst.fm/e/chrt.fm/track/CHRT123/pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' }, 
            { kind: 'prefix', prefix: 'chartable', url: 'https://chrt.fm/track/CHRT123/pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' }, 
            { kind: 'prefix', prefix: 'veritonic', url: 'https://pfx.veritonicmetrics.com/vt123/arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' }, 
            { kind: 'prefix', prefix: 'artsai', url: 'https://arttrk.com/p/ARTS1/sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' }, 
            { kind: 'destination', url: 'https://sub.example.com/media/1234/episodes/123-Something-456_zz7f.mp3' },
        ]);
    }
});
