import { assertEquals } from './tests/deps.ts';
import worker from './worker.ts';

// looks trivial, but this ensures any worker dep issue surfaces as a test failure

Deno.test({
    name: 'worker',
    fn: () => {
        assertEquals(typeof worker.fetch, 'function');
        assertEquals(typeof worker.queue, 'function');
    }
});
