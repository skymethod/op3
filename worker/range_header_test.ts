import { assertEquals } from './tests/deps.ts';
import { ByteRange, estimateByteRangeSize, tryParseRangeHeader } from './range_header.ts';

Deno.test({
    name: 'rangeHeader',
    fn: () => {
        const cases: Record<string, ByteRange[]> = {
            'bytes=0-1': [ { start: 0, end: 1} ],
            'bytes=0-0': [ { start: 0, end: 0} ],
            'bytes=0-1, 20-': [ { start: 0, end: 1}, { start: 20 } ],
            'bytes=-1': [ { suffix: 1 } ],
            'bytes=-1000': [ { suffix: 1000 } ],
        };
        for (const [ input, expected ] of Object.entries(cases)) {
            assertEquals(tryParseRangeHeader(input), expected);
        }

        const bad = [
            'byte=0-1',
            'bytes=1-0',
            'bytes=0-0,',
            'bytes=-0',
        ];
        for (const input of bad) {
            assertEquals(tryParseRangeHeader(input), undefined);
        }

        assertEquals(estimateByteRangeSize({ suffix: 1 }), 1);
        assertEquals(estimateByteRangeSize({ start: 1 }), Number.MAX_SAFE_INTEGER);
        assertEquals(estimateByteRangeSize({ start: 1, end: 1 }), 1);
        assertEquals(estimateByteRangeSize({ start: 100, end: 1000 }), 901);
    }
});
