import { Bytes } from '../deps.ts';
import { packHashedIpAddress } from '../ip_addresses.ts';
import { StubRpcClient } from '../rpc_clients.ts';
import { PackedRedirectLogsResponse, QueryPackedRedirectLogsRequest, Unkinded } from '../rpc_model.ts';
import { assertEquals, fail } from '../tests/deps.ts';
import { InMemoryBlobs } from '../tests/in_memory_blobs.ts';
import { AttNums } from './att_nums.ts';
import { computeHourlyDownloads, computeHourlyKey, fastHex } from './downloads.ts';
import { TimestampSequence, unpackTimestampId } from './timestamp_sequence.ts';

Deno.test({
    name: 'computeHourlyDownloads',
    fn: async () => {
        FixedLengthStream.register();
        const hour = '2023-01-06T00';
        const querySize = 10000;
        const statsBlobs = new InMemoryBlobs();
        const rpcClient = new class extends StubRpcClient {
            async queryPackedRedirectLogs(request: Unkinded<QueryPackedRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse> {
                await Promise.resolve();
                const { startTimeInclusive, startTimeExclusive, endTimeExclusive, startAfterRecordKey, limit} = request;
                if (target === 'combined-redirect-log' && startTimeInclusive === '2023-01-06T00:00:00.000Z' && endTimeExclusive === '2023-01-06T01:00:00.000Z' && limit === querySize && startTimeExclusive === undefined && startAfterRecordKey === undefined) {
                    const seq = new TimestampSequence(3);
                    const attNums = new AttNums();
                    const records: Record<string, string> = {};
                    const addHit = ({ url, ipAddress, range = '', ipSource }: { url: string, ipAddress: string, range?: string, ipSource?: string }) => {
                        const timestampId = seq.next();
                        const { timestamp } = unpackTimestampId(timestampId);
                        const signature = Bytes.ofUtf8(ipAddress);
                        const hashedIpAddress = packHashedIpAddress('1', signature);
                        const record = attNums.packRecord({ method: 'GET', range, url, hashedIpAddress, userAgent: 'test-agent', timestamp, 'other.country': 'US', ...(ipSource ? { ipSource } : {}) });
                        records[timestampId] = record;
                    }
                    addHit({ url: 'https://a.com/1.mp3', ipAddress: '0.1' });
                    addHit({ url: 'https://a.com/1.mp3', ipAddress: '0.1' });
                    addHit({ url: 'https://a.com/1.mp3', ipAddress: '0.1.2' });
                    addHit({ url: 'https://a.com/2.mp3', ipAddress: '0.2', range: 'bytes=0-1' });
                    addHit({ url: 'https://a.com/2.mp3', ipAddress: '0.2', range: 'bytes=0-10' }); // overrides
                    addHit({ url: 'https://a.com/3.mp3', ipAddress: '0.3', range: 'bytes=0-1' });
                    addHit({ url: 'https://a.com/4.mp3', ipAddress: '0.4' });
                    addHit({ url: 'https://a.com/5.mp3', ipAddress: '0.5', range: 'bytes=1000-1000' }); // ignored
                    addHit({ url: 'https://a.com/6.mp3', ipAddress: '0.6', range: 'bytes=1000-1001' }); // ignored
                    addHit({ url: 'https://a.com/7.mp3', ipAddress: '0.7', ipSource: 'x-forwarded-for' }); // geoatts cleared
                    addHit({ url: 'https://a.com/8.mp3', ipAddress: '0.8' }); // geoatts maintained
                    const namesToNums = attNums.toJson();
                    return { kind: 'packed-redirect-logs', namesToNums, records };
                }
                return await super.queryPackedRedirectLogs(request, target);
            }
        }
        const res = await computeHourlyDownloads(hour, { statsBlobs, rpcClient, maxHits: 1000000, maxQueries: 100, querySize });
        assertEquals(res.downloads, 7);
        const key = computeHourlyKey(hour);
        const downloads = await statsBlobs.get(key, 'text');
        if (!downloads) fail('no downloads blob');

        const lines = downloads.split('\n').filter(v => v !== '');
        assertEquals(lines.length, 8);
        const headers = lines[0].split('\t');
        const serverUrlIndex = headers.indexOf('serverUrl');
        const tagsIndex = headers.indexOf('tags');
        const countryCodeIndex = headers.indexOf('countryCode');

        const firstTwoOverridden = lines[3].split('\t');
        assertEquals(firstTwoOverridden[serverUrlIndex], 'https://a.com/2.mp3');
        assertEquals(firstTwoOverridden[tagsIndex], '');

        const firstTwo = lines[4].split('\t');
        assertEquals(firstTwo[serverUrlIndex], 'https://a.com/3.mp3');
        assertEquals(firstTwo[tagsIndex], 'first-two');

        assertEquals(lines[6].split('\t')[countryCodeIndex], '');  // geoatts cleared
        assertEquals(lines[7].split('\t')[countryCodeIndex], 'US');  // geoatts maintained
    }
});

Deno.test({
    name: 'fastHex',
    fn: () => {
        const inputs = [
            new Uint8Array(),
            new Uint8Array([ 255, 0, 128 ]),
            new TextEncoder().encode('hello'),
            new TextEncoder().encode(''),
        ];
        for (const input of inputs) {
            console.log(input);
            assertEquals(fastHex(input), new Bytes(input).hex());
        }
    }
});

//

class FixedLengthStream {
    // deno-lint-ignore no-explicit-any
    readonly readable: ReadableStream<any>;
    // deno-lint-ignore no-explicit-any
    readonly writable: WritableStream<any>;

    constructor() {
        const { readable, writable } = new TransformStream();
        this.readable = readable;
        this.writable = writable;
    }

    static register() {
        // deno-lint-ignore no-explicit-any
        (globalThis as any).FixedLengthStream = FixedLengthStream

    }

}
