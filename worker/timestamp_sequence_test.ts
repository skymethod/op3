import { assertEquals, assertThrows } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { computeTimestamp } from './timestamp.ts';
import { TimestampSequence } from './timestamp_sequence.ts';

Deno.test({
    name: 'TimestampSequence',
    fn: () => {
        const realNow = Date.now();
        let seq = new TimestampSequence(0);
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow));
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow + 1));
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow + 2));

        seq = new TimestampSequence(1);
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow) + '0');
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow) + '1');
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow) + '2');
        for (let i = 3; i < 8; i++) seq.next(() => realNow);
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow) + '8');
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow) + '9');
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow + 1) + '0');
        assertEquals(seq.next(() => realNow + 2), computeTimestamp(realNow + 2) + '0');
        
        seq = new TimestampSequence(3);
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow) + '000');
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow) + '001');
        assertEquals(seq.next(() => realNow), computeTimestamp(realNow) + '002');

        seq = new TimestampSequence(3);
        assertThrows(() => {
            seq.next(() => -1);
        });
    }
});
