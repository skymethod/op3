import { isValidDate, isValidMonth } from './check.ts';
import { assertEquals, assert } from './tests/deps.ts';
import { addDaysToDateString, addMonthsToMonthString, computeRfc822, computeTimestamp, isValidTimestamp, unpackDate } from './timestamp.ts';

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

Deno.test({
    name: 'addDaysToDateString',
    fn: () => {
        assertEquals(addDaysToDateString('2022-01-01', 1), '2022-01-02');
        let date = '2020-01-01'; // leap year
        const seen = new Set<string>();
        for (let i = 0; i < 366; i++) {
            date = addDaysToDateString(date, 1);
            assert(isValidDate(date));
            assert(!seen.has(date));
            seen.add(date);
        }
        assertEquals(date, '2021-01-01');
    }
});

Deno.test({
    name: 'addMonthsToMonthString',
    fn: () => {
        assertEquals(addMonthsToMonthString('2022-01', -1), '2021-12');
        let month = '2020-01'; // leap year
        const seen = new Set<string>();
        for (let i = 0; i < 12; i++) {
            month = addMonthsToMonthString(month, 1);
            assert(isValidMonth(month));
            assert(!seen.has(month));
            seen.add(month);
        }
        assertEquals(month, '2021-01');
    }
});

Deno.test({
    name: 'unpackDate',
    fn: () => {
        assertEquals(unpackDate('2022-01-02'), { year: 2022, month: 1, day: 2 });
    }
});
