import { assertEquals, assertNotEquals } from './tests/deps.ts';
import { shuffleArray } from './shuffle_array.ts';

Deno.test('shuffleArray', () => {
    assertEquals(shuffleArray([ 1, 2, 3 ]).length, 3);
    assertEquals(shuffleArray([ 1, 2, 3 ]).toSorted(), [ 1, 2, 3 ]);
    const large = Array.from({ length: 400 }, (_, i) => i);
    const shuffled = shuffleArray(large);
    assertNotEquals(shuffled, large);
    assertEquals(shuffled.toSorted((a, b) => a - b), large);
});
