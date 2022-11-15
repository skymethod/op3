import { assertEquals } from './tests/deps.ts';
import { findPublicSuffix } from './public_suffixes.ts';

Deno.test({
    name: 'findPublicSuffix',
    fn: () => {
        assertEquals(findPublicSuffix('https://a.b.google.com'), 'com');
        assertEquals(findPublicSuffix('https://a.b.google.com', 1), 'google.com');
        assertEquals(findPublicSuffix('https://a.b.google.com', 2), 'b.google.com');
        assertEquals(findPublicSuffix('https://a.b.developer.app', 0), 'b.developer.app');
        assertEquals(findPublicSuffix('https://a.ck', 0), 'a.ck');
        assertEquals(findPublicSuffix('https://www.ck', 0), 'ck');
        assertEquals(findPublicSuffix('https://www.ck', 1), 'www.ck');
        assertEquals(findPublicSuffix('ftp://a.com'), 'com');

        assertEquals(findPublicSuffix('https://localhost'), undefined);
        assertEquals(findPublicSuffix('asdf'), undefined);
    }
});
