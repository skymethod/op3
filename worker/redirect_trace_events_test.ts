import { assertEquals } from './tests/deps.ts';
import { packAppleVersion } from './redirect_trace_events.ts';

Deno.test({
    name: 'packAppleVersion',
    fn: () => {
        const cases: Record<string, number> = {
            '1111.2222.3333.4444': 1111222233334444,
            '0001.0000.0000.0001': 1000000000001,
        };
        for (const [ input, expected ] of Object.entries(cases)) {
            assertEquals(packAppleVersion(input), expected);
        }
    }
});
