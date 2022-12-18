import { assertEquals, assert } from './tests/deps.ts';
import { isValidDate, isValidMonth, tryNormalizeInstant } from './check.ts';

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

Deno.test({
    name: 'isValidMonth',
    fn: () => {
        const good = [ 
            '2022-12', 
            '2001-01',
        ];
        good.forEach(month => assert(isValidMonth, month));

        const bad = [
            '2011-00',
            '2011-13',
        ]
        bad.forEach(month => assertEquals(false, isValidMonth(month), month));
    }
});

Deno.test({
    name: 'isValidDate',
    fn: () => {
        const good = [ 
            '2022-12-31', 
            '2001-01-01',
        ];
        good.forEach(date => assert(isValidDate, date));

        const bad = [
            '2011-01-00',
            '2011-01-32',
            '2011-00-01',
            '3011-01-01',
        ]
        bad.forEach(date => assertEquals(false, isValidDate(date), date));
    }
});
