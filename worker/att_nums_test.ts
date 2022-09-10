import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { AttNums } from './att_nums.ts';

Deno.test({
    name: 'AttNums',
    fn: () => {
        const attNums = new AttNums();
        assertEquals(attNums.get('id'), 0);
        assertEquals(attNums.get('id'), 0);
        assertEquals(attNums.get('name'), 1);
        assertEquals(attNums.get('id'), 0);
        assertEquals(attNums.get('description'), 2);

        assertEquals(attNums.toJson(), { id: 0, name: 1, description: 2 });
        assertEquals(AttNums.fromJson(attNums.toJson()).toJson(), attNums.toJson());
    }
});
