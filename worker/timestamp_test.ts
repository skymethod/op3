import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { computeRfc822, computeTimestamp, isValidTimestamp } from './timestamp.ts';

Deno.test({
    name: 'computeTimestamp',
    fn: () => {
        assertEquals(computeTimestamp('2022-09-10T20:09:20.153Z'), '220910200920153');
        assertEquals(computeTimestamp(1662840560153), '220910200920153');
        assertEquals(computeTimestamp(new Date(1662840560153)), '220910200920153');
        assertEquals(isValidTimestamp(computeTimestamp()), true);
    }
});


Deno.test({
    name: 'isValidTimestamp',
    fn: () => {
        const good = [
            '220910200920153',
            '230910200920000',
        ];
        for (const ts of good) {
            assertEquals(isValidTimestamp(ts), true);
        }

        const bad = [
            '2209102009201532',
            '23091d200920000',
            '230912200920000 ',
        ];
        for (const ts of bad) {
            assertEquals(isValidTimestamp(ts), false);
        }
    }
});

Deno.test({
    name: 'computeRfc822',
    fn: () => {
        assertEquals(computeRfc822('2022-09-18T16:18:54.780Z'), 'Sun, 18 Sep 2022 16:18:54 GMT');
    }
});
