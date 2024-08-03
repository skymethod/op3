import { DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageValue } from '../deps.ts';
import { assertEquals, InMemoryDurableObjectStorage } from '../tests/deps.ts';
import { computeTimestamp } from '../timestamp.ts';
import { generateUuid } from '../uuid.ts';
import { computeRecordInfo } from './hits_common.ts';
import { computeIndexRecords, computeMonthEndSuffix, queryHitsIndexFromStorage, trimIndexRecords } from './hits_indexes.ts';

Deno.test({
    name: 'queryHitsIndexFromStorage',
    fn: async () => {
        const now = new Date('2024-08-03T23:07:04.937Z').getTime();
        const storage = new TestStorage();

        const hashedIpAddress = 'a97a03cf1a863b356f8ac2fdc117577a66251fe3';
        const url = 'https://example.com/path/to/file.mp3';
        const record: Record<string, string> = {
            timestamp: computeTimestamp('2024-07-08T07:04:59.476Z'),
            uuid: generateUuid(),
            hashedIpAddress: `1:${hashedIpAddress}`,
            url,
        };
        const { sortKey, timestamp } = computeRecordInfo(record);

        const outIndexRecords: Record<string, string> = {};
        await computeIndexRecords(record, timestamp, sortKey, outIndexRecords);
        await storage.put(outIndexRecords);

        assertEquals(await queryHitsIndexFromStorage({ limit: 1, hashedIpAddress, descending: false }, storage, now), [ sortKey ]);
        assertEquals(await queryHitsIndexFromStorage({ limit: 1, url, descending: false, startTimeInclusive: '2024-07-08T00:00:00.000Z' }, storage, now), [ sortKey ]);
    }
});

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
