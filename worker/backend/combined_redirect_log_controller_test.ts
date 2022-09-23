import { assertEquals, assertNotEquals } from '../tests/deps.ts';
import { InMemoryDurableObjectStorage } from '../tests/deps.ts';
import { CombinedRedirectLogController, IndexId } from './combined_redirect_log_controller.ts';
import { StubRpcClient } from '../tests/stub_rpc_client.ts';
import { Unkinded,GetNewRedirectLogsRequest,GetNewRedirectLogsResponse } from '../rpc_model.ts';
import { AttNums } from './att_nums.ts';
import { TimestampSequence } from './timestamp_sequence.ts';
import { generateUuid } from '../uuid.ts';
import { computeTimestamp, timestampToInstant } from '../timestamp.ts';
import { hmac, isValidSha1Hex } from '../crypto.ts';
import { Bytes } from '../deps.ts';
import { generateHmacKeyBytes } from '../crypto.ts';
import { packHashedIpAddress, unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { importHmacKey } from '../crypto.ts';
import { assert } from 'https://deno.land/std@0.144.0/_util/assert.ts';
import { isStringRecord } from '../check.ts';

Deno.test({
    name: 'process -> queryRedirectLogs -> index-and-record-storage',
    fn: async () => {
        const storage = new InMemoryDurableObjectStorage();
        await storage.put('crl.ss.test', { doName: 'test' });
        const timestamp = computeTimestamp();
        const ulid = generateUuid();
        const url = `https://example.com/path/to/episode1.mp3`;
        const uuid = generateUuid();
        const timestampAndUuid = `${timestamp}-${uuid}`;
        const keyBytes = await generateHmacKeyBytes();
        const key = await importHmacKey(keyBytes);
        const keyId = 'a';
        const signature = await hmac(Bytes.ofUtf8('1.2.3.4'), key);
        const packedHashedIpAddress = packHashedIpAddress(keyId, signature);
        const hashedIpAddress = unpackHashedIpAddressHash(packedHashedIpAddress);
        const method = 'GET';
        const userAgent = 'test/0.0.0';
        const referer = 'https://example.com';
        const range = 'bytes: 0-1';
        const edgeColo = 'TST';
        const rpcClient = new class extends StubRpcClient {
            async getNewRedirectLogs(request: Unkinded<GetNewRedirectLogsRequest>, target: string): Promise<GetNewRedirectLogsResponse> {
                await Promise.resolve();
                if (target === 'test') {
                    const seq = new TimestampSequence(3);
                    const key1 = seq.next();
                    const attNums = new AttNums();
                    const packed = attNums.packRecord({ uuid, url, timestamp, hashedIpAddress: packedHashedIpAddress, method, userAgent, referer, range, ulid, 'other.colo': edgeColo  });
                    const records: Record<string, string> = {};
                    records[key1] = packed;
                    return {
                        kind: 'get-new-redirect-logs',
                        namesToNums: attNums.toJson(),
                        records,
                    }
                }
                throw new Error(JSON.stringify({ request, target }));
            }
        }
        const controller = new CombinedRedirectLogController(storage, rpcClient);
        await controller.process();

        // ensure basic query returns the saved record
        const res = await controller.queryRedirectLogs({ limit: 10, format: 'json' });
        assertEquals(res.status, 200);
        const { rows } = await res.json();
        // console.log(rows);
        assertEquals([ { time: timestampToInstant(timestamp), uuid, url, hashedIpAddress, method, userAgent, range, ulid, edgeColo } ], rows);
        // ensure the hashed ip address is a sha, not equal to the input raw ip address
        assertNotEquals(hashedIpAddress, '1.2.3.4')
        assert(isValidSha1Hex(hashedIpAddress));

        // ensure saved row count
        const data = await storage.list();
        // console.log(data);
        assertEquals(data.size, 10 /* index records: 12 - DoColo (not in test) - Method (GETs not indexed) */ + 1 /* data record */ + 1 /* source info */ + 1 /* attnums */);

        // ensure attnums
        const namesToNums = data.get('crl.attNums');
        assert(isStringRecord(namesToNums));
        const attNums2 = new AttNums(namesToNums as Record<string, number>);
        assertEquals(attNums2.max(), 10);

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
    }
});
