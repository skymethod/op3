import { DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageValue } from '../deps.ts';
import { assertEquals, InMemoryDurableObjectStorage } from '../tests/deps.ts';
import { computeMonthEndSuffix, trimIndexRecords } from './hits_indexes.ts';

Deno.test({
    name: 'computeMonthEndSuffix',
    fn: () => {
        const tests: Record<string, string | undefined> = {
            '2024-08-01': '2404.09', // daysToWork: 30
            '2024-08-10': '2404.53', // daysToWork: 21
            '2024-08-14': '2404.74', // daysToWork: 17
            '2024-08-15': '2404.7c', // daysToWork: 16
            '2024-08-16': '2404.84', // daysToWork: 15
            '2024-08-17': '2404.8c', // daysToWork: 14
            '2024-08-18': '2404.95', // daysToWork: 13
            '2024-08-29': '2404.ef', // daysToWork: 2
            '2024-08-30': '2405',    // daysToWork: 1
            '2024-08-31': '2405.09', // daysToWork: 30
        };
        for (const [ date, expected ] of Object.entries(tests)) {
            assertEquals(computeMonthEndSuffix(new Date(`${date}T00:00:00Z`).getTime()), expected);
        }
    }
});

Deno.test({
    name: 'trimIndexRecords',
    fn: async () => {

        const rt1 = await trimIndexRecords({ maxIterations: 1, go: false, type: 'month', now: new Date(`2024-08-01T00:00:00.000Z`).getTime() }, new TestStorage());
        assertEquals(rt1, { MonthHashedIpAddress: { deleted: 0, end: `hits.i0.1.2404.09`, iterations: 1, listed: 0 }});

        const rt2 = await trimIndexRecords({ maxIterations: 1, go: false, type: 'month', now: new Date(`2024-08-30T00:00:00.000Z`).getTime() }, new TestStorage());
        assertEquals(rt2, { MonthHashedIpAddress: { deleted: 0, end: `hits.i0.1.2405`, iterations: 1, listed: 0 }});

        const rt3 = await trimIndexRecords({ maxIterations: 1, go: false, type: 'month', now: new Date(`2024-08-31T00:00:00.000Z`).getTime() }, new TestStorage());
        assertEquals(rt3, { MonthHashedIpAddress: { deleted: 0, end: `hits.i0.1.2405.09`, iterations: 1, listed: 0 }});
    }
});

class TestStorage extends InMemoryDurableObjectStorage {
    list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        const { allowConcurrency: _, noCache: __, ...rest } = options;
        return super.list(rest);
    }
}
