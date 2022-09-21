import { assertEquals } from './tests/deps.ts';
import { IsolateId } from './isolate_id.ts';

Deno.test({
    name: 'IsolateId.get',
    fn: () => {
        assertEquals(IsolateId.get(), IsolateId.get());
    }
});
