import { assertEquals } from './tests/deps.ts';
import { splitArray } from './split_array.ts';

Deno.test('splitArray', () => {
    assertEquals(splitArray([ ], 1), [ [  ] ]);
    assertEquals(splitArray([ ], 2), [ [  ], [ ] ]);
    assertEquals(splitArray([ 1 ], 1), [ [ 1 ] ]);
    assertEquals(splitArray([ 1 ], 2), [ [ 1 ], [ ] ]);
    assertEquals(splitArray([ 1, 2 ], 2), [ [ 1 ], [ 2 ] ]);
    assertEquals(splitArray([ 1, 2, 3 ], 2), [ [ 1, 2 ], [ 3 ] ]);
    assertEquals(splitArray([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ], 3), [ [ 1, 2, 3], [ 4, 5, 6 ], [ 7, 8, 9 ] ]);
});
