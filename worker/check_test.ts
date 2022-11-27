import { assertEquals } from './tests/deps.ts';
import { tryNormalizeInstant } from './check.ts';

Deno.test({
    name: 'tryNormalizeInstant',
    fn: () => {
        assertEquals(tryNormalizeInstant('https://a.com/foo?_ulid=asdf'), undefined);
        assertEquals(tryNormalizeInstant('2022-11-20T00:00:00.000000Z'), '2022-11-20T00:00:00.000Z');
        assertEquals(tryNormalizeInstant('2022-11-20T00:00:00Z'), '2022-11-20T00:00:00.000Z');
        assertEquals(tryNormalizeInstant('2022-11-20T00:00:00.123Z'), '2022-11-20T00:00:00.123Z');
        assertEquals(tryNormalizeInstant('2022-11-20T00:00:00.Z'), undefined);
        assertEquals(tryNormalizeInstant('2022-11-20T00:00Z'), undefined);
        assertEquals(tryNormalizeInstant('2022-11-20T00:00:00.12Z'), '2022-11-20T00:00:00.120Z');
        assertEquals(tryNormalizeInstant('2022-11-20T00:00:00.1Z'), '2022-11-20T00:00:00.100Z');
        assertEquals(tryNormalizeInstant('2022-11-20T00:00:00.1239Z'), '2022-11-20T00:00:00.123Z'); // truncates, not rounds
        assertEquals(tryNormalizeInstant('2022-11-20T00:00:00.12345678901234567890Z'), '2022-11-20T00:00:00.123Z');
    }
});
