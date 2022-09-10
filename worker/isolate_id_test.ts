import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { IsolateId } from './isolate_id.ts';

Deno.test({
    name: 'IsolateId.get',
    fn: () => {
        assertEquals(IsolateId.get(), IsolateId.get());
    }
});
