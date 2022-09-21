import { assertEquals } from './tests/deps.ts';
import { tryParseDurationMillis } from './duration.ts';

Deno.test({
    name: 'tryParseDurationMillis',
    fn: () => {
        const good = {
            '0h': 0,
            '-24h': -24 * 1000 * 60 * 60,
            '5m': 5 * 1000 * 60,
            '+5m': 5 * 1000 * 60,
        };
        for (const [ input, expected ] of Object.entries(good)) {
            assertEquals(tryParseDurationMillis(input), expected);
        }

        const bad = ['0', '1a', '*dh'];
        for (const input of bad) {
            assertEquals(tryParseDurationMillis(input), undefined);
        }
    }
});
