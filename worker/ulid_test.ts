import { assertEquals } from './tests/deps.ts';
import { tryParseUlid } from './ulid.ts';

Deno.test({
    name: 'tryParseUlid',
    fn: () => {
        assertEquals(tryParseUlid('https://a.com/foo?_ulid=asdf'), { url: 'https://a.com/foo', ulid: 'asdf' });
        assertEquals(tryParseUlid('https://a.com/foo?a=b&_ulid=asdf2'), { url: 'https://a.com/foo?a=b', ulid: 'asdf2' });
        assertEquals(tryParseUlid('https://a.com/foo?_ulid=asdf3&a=b'), { url: 'https://a.com/foo?a=b', ulid: 'asdf3' });
        assertEquals(tryParseUlid('https://a.com/foo?a=b&_ulid=asdf4&c=d'), { url: 'https://a.com/foo?a=b&c=d', ulid: 'asdf4' });
        assertEquals(tryParseUlid('https://a.com/foo?_ulid='), { url: 'https://a.com/foo' });

        assertEquals(tryParseUlid('https://a.com/foo?ulid=asdf'), { url: 'https://a.com/foo?ulid=asdf' });
    }
});
