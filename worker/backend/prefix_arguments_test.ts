import { assertEquals } from '../tests/deps.ts';
import { tryParsePrefixArguments } from './prefix_arguments.ts';

Deno.test({
    name: 'tryParsePrefixArguments',
    fn: () => {
        const opts = { origin: 'https://example.com' };
        assertEquals(tryParsePrefixArguments('http://example.com/e,pg=9d99bc2b-5aa3-4a24-b43f-b6b25f63d274/a.com/ep.mp3', opts), { pg: '9d99bc2b-5aa3-4a24-b43f-b6b25f63d274' });
        assertEquals(tryParsePrefixArguments('https://example.com/e,pg%3D9d99bc2b-5aa3-4a24-b43f-b6b25f63d274/a.com/ep.mp3', opts), { pg: '9d99bc2b-5aa3-4a24-b43f-b6b25f63d274' });
        assertEquals(tryParsePrefixArguments('https://example.com/e,pg=9d99bc2b-5aa3-4a24-b43f-b6b25f63d274/a.com/ep.mp3', opts), { pg: '9d99bc2b-5aa3-4a24-b43f-b6b25f63d274' });
        assertEquals(tryParsePrefixArguments('https://prefix-a.com/example.com/e,pg=9d99bc2b-5aa3-4a24-b43f-b6b25f63d274/a.com/ep.mp3', opts), { pg: '9d99bc2b-5aa3-4a24-b43f-b6b25f63d274' });
        assertEquals(tryParsePrefixArguments('https://prefix-a.com/example.com/e,pg=9d99bc2b-5aa3-4a24-b43f-b6b25f63d274,hls=1/a.com/ep.mp3', opts), { pg: '9d99bc2b-5aa3-4a24-b43f-b6b25f63d274', hls: '1' });

        assertEquals(tryParsePrefixArguments('https://prefix-a.com/example.com/e,pg=9d99bc2b-5aa3-4a24-b43f-b6b25f63d27/a.com/ep.mp3', opts), undefined);
        assertEquals(tryParsePrefixArguments('https://prefix-a.com/example.com/e,foo=9d99bc2b-5aa3-4a24-b43f-b6b25f63d27/a.com/a.com/ep.mp3', opts), undefined);
    }
});
