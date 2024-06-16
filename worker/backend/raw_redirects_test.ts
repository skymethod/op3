import { assertEquals } from '../tests/deps.ts';
import { AttNums } from './att_nums.ts';
import { IpAddressEncryptionFn, IpAddressHashingFn, computeRawRedirect, packRawRedirect } from './raw_redirects.ts';

Deno.test({
    name: 'compute-pack-x-forwarded-for',
    fn: async () => {
        const time = Date.now();
        const method = 'GET';
        const rawIpAddress = '1.2.3.4';
        const attNums = new AttNums();
        const doColo = 'TST';
        const encryptIpAddress: IpAddressEncryptionFn = v => Promise.resolve(v);
        const hashIpAddress: IpAddressHashingFn = v => Promise.resolve(v);
        {
            const rawRedirect = computeRawRedirect(new Request('https://example.com'), { time, method, rawIpAddress, other: { asn: '123' } });
            assertEquals(rawRedirect.rawIpAddress, '1.2.3.4');
            assertEquals(rawRedirect.ipSource, undefined);
            const record = await packRawRedirect(rawRedirect, attNums, doColo, 'test', encryptIpAddress, hashIpAddress);
            assertEquals(attNums.max(), 8);
            const { ipSource } = attNums.unpackRecord(record);
            assertEquals(ipSource, undefined);
        }
        {
            const rawRedirect = computeRawRedirect(new Request('https://example.com', { headers: { 'X-Forwarded-For': '2.3.4.5', 'User-Agent': 'Mozilla/5.0 (Cloud Phone; Nokia 110 4G)' }}), { time, method, rawIpAddress, other: { asn: '174' } });
            assertEquals(rawRedirect.rawIpAddress, '2.3.4.5');
            assertEquals(rawRedirect.ipSource, 'x-forwarded-for');
            const record = await packRawRedirect(rawRedirect, attNums, doColo, 'test', encryptIpAddress, hashIpAddress);
            assertEquals(attNums.max(), 10); // + userAgent + ipSource
            const { ipSource } = attNums.unpackRecord(record);
            assertEquals(ipSource, 'x-forwarded-for');
        }
        {
            const rawRedirect = computeRawRedirect(new Request('https://example.com', { headers: { 'X-Forwarded-For': '2.3.4.5, 3.4.5.6', 'User-Agent': 'Mozilla/5.0 (Cloud Phone; Nokia 110 4G)' }}), { time, method, rawIpAddress, other: { asn: '174' } });
            assertEquals(rawRedirect.rawIpAddress, '2.3.4.5');
            assertEquals(rawRedirect.ipSource, 'x-forwarded-for');
            const record = await packRawRedirect(rawRedirect, attNums, doColo, 'test', encryptIpAddress, hashIpAddress);
            assertEquals(attNums.max(), 10); // + userAgent + ipSource
            const { ipSource } = attNums.unpackRecord(record);
            assertEquals(ipSource, 'x-forwarded-for');
        }
    }
});
