import { assertEquals, assertNotEquals } from '../tests/deps.ts';
import { InMemoryDurableObjectStorage, assert } from '../tests/deps.ts';
import { CombinedRedirectLogController, IndexId } from './combined_redirect_log_controller.ts';
import { StubRpcClient } from '../rpc_clients.ts';
import { Unkinded, GetNewRedirectLogsRequest, PackedRedirectLogsResponse, ExternalNotificationRequest, OkResponse, isUrlInfo } from '../rpc_model.ts';
import { AttNums } from './att_nums.ts';
import { TimestampSequence } from './timestamp_sequence.ts';
import { generateUuid } from '../uuid.ts';
import { computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { hmac, isValidSha1Hex } from '../crypto.ts';
import { Bytes } from '../deps.ts';
import { generateHmacKeyBytes } from '../crypto.ts';
import { packHashedIpAddress, unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { importHmacKey } from '../crypto.ts';
import { isStringRecord } from '../check.ts';
import { DoNames } from '../do_names.ts';
import { IpAddressHashingFn } from './redirect_log_controller.ts';
import { increment } from '../summaries.ts';

Deno.test({
    name: 'process -> queryRedirectLogs -> index-and-record-storage',
    fn: async () => {
        const storage = new InMemoryDurableObjectStorage();
        await storage.put('crl.ss.test', { doName: 'test' });
       
        const record = await generateRecord();

        const hashedIpAddress = unpackHashedIpAddressHash(record.hashedIpAddress);
      
        const rpcClient = new class extends StubRpcClient {
            async getNewRedirectLogs(request: Unkinded<GetNewRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse> {
                await Promise.resolve();
                if (target === 'test') {
                    const seq = new TimestampSequence(3);
                    const key1 = seq.next();
                    const attNums = new AttNums();
                    const packed = attNums.packRecord(record);
                    const records: Record<string, string> = {};
                    records[key1] = packed;
                    return {
                        kind: 'packed-redirect-logs',
                        namesToNums: attNums.toJson(),
                        records,
                    }
                }
                throw new Error(JSON.stringify({ request, target }));
            }
            async receiveExternalNotification(request: Unkinded<ExternalNotificationRequest>, target: string): Promise<OkResponse> {
                await Promise.resolve();
                if (target === DoNames.showServer && request.notification.type === 'urls') {
                    assertEquals(request.notification.urls.length, 1);
                    assertEquals(request.notification.urls[0].url, record.url);
                    return { kind: 'ok' };
                }
                throw new Error(JSON.stringify({ request, target }));
            }
        }
        const hashIpAddress: IpAddressHashingFn = () => { throw new Error() };
        const controller = new CombinedRedirectLogController(storage, rpcClient, 'controller-test', hashIpAddress);
        await controller.process();

        const { timestamp, uuid, url, method, userAgent, referer, range, ulid, 'other.colo': edgeColo, xpsId } = record;
        const timestampAndUuid = `${timestamp}-${uuid}`;

        {
            // ensure basic query returns the saved record
            const res = await controller.queryRedirectLogs({ limit: 10, format: 'json' });
            assertEquals(res.status, 200);
            const { rows } = await res.json();
            // console.log(rows);
            assertEquals([ { time: timestampToInstant(timestamp), uuid, url, hashedIpAddress, method, userAgent, referer, range, ulid, edgeColo, xpsId } ], rows);
            // ensure the hashed ip address is a sha, not equal to the input raw ip address
            assertNotEquals(hashedIpAddress, '1.2.3.4')
            assert(isValidSha1Hex(hashedIpAddress));

            // ensure saved row count
            const data = await storage.list();
            // console.log(data);
            assertEquals(data.size, 7 /* index records: 7 - Method (GETs not indexed) */ + 1 /* data record */ + 1 /* source info */ + 1 /* attnums */ + 1 /* url record (pending was sent) */);

            // ensure attnums
            const namesToNums = data.get('crl.attNums');
            assert(isStringRecord(namesToNums));
            const attNums2 = new AttNums(namesToNums as Record<string, number>);
            assertEquals(attNums2.max(), 12);

            // ensure data record
            const record = data.get(`crl.r.${timestampAndUuid}`);
            assert(typeof record === 'string');
            const obj = attNums2.unpackRecord(record);
            // console.log(obj);
            assert(isStringRecord(obj));
            assertEquals(obj.uuid, uuid);

            // ensure DayUrl is indexed as expected
            const expectedDayUrlValueKey = `crl.r.${timestampAndUuid}`;
            const expectedDayUrlValue = data.get(`crl.i0.${IndexId.DayUrl}.${timestamp.substring(0, 6)}.${url}.${timestampAndUuid}`);
            assert(isStringRecord(expectedDayUrlValue));
            const { key: actualDayUrlValueKey } = expectedDayUrlValue;
            assertEquals(actualDayUrlValueKey, expectedDayUrlValueKey);

            // ensure url record
            const urlRecord = data.get(`crl.u0.${url}`);
            assert(isUrlInfo(urlRecord));
            assertEquals(urlRecord.url, url);
        }

        {
            // ensure successful urlStartsWith query
            const res = await controller.queryRedirectLogs({ limit: 10, format: 'json', urlStartsWith: 'https://example.com/path/to/' });
            assertEquals(res.status, 200);
            const { rows } = await res.json();
            // console.log(rows);
            assert(Array.isArray(rows));
            assertEquals(rows.length, 1);
        }

        {
            // ensure empty urlStartsWith query
            const res = await controller.queryRedirectLogs({ limit: 10, format: 'json', urlStartsWith: 'https://example2.com/path/to/' });
            assertEquals(res.status, 200);
            const { rows } = await res.json();
            // console.log(rows);
            assert(Array.isArray(rows));
            assertEquals(rows.length, 0);
        }

        {
            // ensure successful xpsId query
            const res = await controller.queryRedirectLogs({ limit: 10, format: 'json', xpsId });
            assertEquals(res.status, 200);
            const { rows } = await res.json();
            // console.log(rows);
            assert(Array.isArray(rows));
            assertEquals(rows.length, 1);
        }

        {
            // ensure successful asn query
            const res = await controller.queryRedirectLogs({ limit: 10, format: 'json', include: 'asn' });
            assertEquals(res.status, 200);
            const { rows } = await res.json();
            assert(Array.isArray(rows));
            assertEquals(rows.length, 1);
            assertEquals(rows[0].asn, '123');
        }
    }
});

Deno.test({
    name: 'process -> multiples',
    fn: async () => {
        const storage = new InMemoryDurableObjectStorage();
        const colos = [ 'AMS', 'ORD', 'DFW', 'ATL' ];
        for (const colo of colos) {
            const doName = DoNames.redirectLogForColo(colo);
            await storage.put(`crl.ss.${doName}`, { doName });
        }
       
        const record = await generateRecord();
        const getNewRedirectLogsCallsByColo: Record<string, number> = {};

        const seq = new TimestampSequence(3);
        const rpcClient = new class extends StubRpcClient {
            async getNewRedirectLogs(request: Unkinded<GetNewRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse> {
                console.log('getNewRedirectLogs');
                await Promise.resolve();
                for (const colo of colos) {
                    const doName = DoNames.redirectLogForColo(colo);
                    if (target === doName) {
                        increment(getNewRedirectLogsCallsByColo, colo);
                       
                        const key1 = seq.next();
                        const attNums = new AttNums();
                        const packed = attNums.packRecord(record);
                        const records: Record<string, string> = {};
                        records[key1] = packed;
                        return {
                            kind: 'packed-redirect-logs',
                            namesToNums: attNums.toJson(),
                            records,
                        }
                    }
                }
                throw new Error(JSON.stringify({ request, target }));
            }
            async receiveExternalNotification(request: Unkinded<ExternalNotificationRequest>, target: string): Promise<OkResponse> {
                console.log(`receiveExternalNotification`);
                await Promise.resolve();
                if (target === DoNames.showServer && request.notification.type === 'urls') {
                    assertEquals(request.notification.urls.length, 1);
                    assertEquals(request.notification.urls[0].url, record.url);
                    return { kind: 'ok' };
                }
                throw new Error(JSON.stringify({ request, target }));
            }
        }
        const hashIpAddress: IpAddressHashingFn = () => { throw new Error() };
        const controller = new CombinedRedirectLogController(storage, rpcClient, 'controller-test', hashIpAddress);
        await controller.process();

        // ensure inner loop called the correct number of times
        assertEquals(getNewRedirectLogsCallsByColo, { AMS: 4, ORD: 2, DFW: 1, ATL: 20 });
    }
});

//

async function generateRecord() {
    const uuid = generateUuid();
    const url = `https://example.com/path/to/episode1.mp3`;
    const timestamp = computeTimestamp();
    const keyId = 'a';
    const keyBytes = await generateHmacKeyBytes();
    const key = await importHmacKey(keyBytes);
    const signature = await hmac(Bytes.ofUtf8('1.2.3.4'), key);
    const packedHashedIpAddress = packHashedIpAddress(keyId, signature);
    const method = 'GET';
    const userAgent = 'test/0.0.0';
    const referer = 'https://example.com';
    const range = 'bytes: 0-1';
    const xpsId = '2C2A32DC-F9D1-4C21-A1D2-7EE48B4B8DEF';
    const edgeColo = 'TST';
    const ulid = generateUuid();
    return { uuid, url, timestamp, hashedIpAddress: packedHashedIpAddress, method, userAgent, referer, range, ulid, xpsId, 'other.colo': edgeColo, 'other.asn': '123' };
}
