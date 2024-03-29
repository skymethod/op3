import { assertEquals, assert } from './tests/deps.ts';
import { Bytes } from './deps.ts';
import { computeIpAddressForDownload, packHashedIpAddress, tryExpandIpv6, unpackHashedIpAddressHash } from './ip_addresses.ts';

Deno.test({
    name: 'ipaddress-packing',
    fn: () => {
        const signature = Bytes.ofUtf8('whatever');
        assertEquals(unpackHashedIpAddressHash(packHashedIpAddress('1', signature)), signature.hex());
    }
});

Deno.test({
    name: 'tryExpandIpv6',
    fn: () => {
        const good: Record<string, string> = {
            '::': '0000:0000:0000:0000:0000:0000:0000:0000',
            '2b68:735b:d7da:025d:05d2:dad1:9215:561b': '2b68:735b:d7da:025d:05d2:dad1:9215:561b',
            'ff01::101': 'ff01:0000:0000:0000:0000:0000:0000:0101',
            '0000:0000:0000:0000:0000:0000:0.0.0.0': '0000:0000:0000:0000:0000:0000:0000:0000',
            '::13.1.68.3': '0000:0000:0000:0000:0000:0000:0d01:4403',
            '::ffff:129.144.52.38': '0000:0000:0000:0000:0000:ffff:8190:3426',
        };
        for (const [ compressed, expected ] of Object.entries(good)) {
            assertEquals(tryExpandIpv6(compressed), expected, compressed);
        }
        const bad = [
            '',
            '1.2.3.4',
            '100.200.300.400',
            'whatever',
            ':',
        ];
        for (const addr of bad) {
            assert(tryExpandIpv6(addr) === undefined, addr);
        }
    }
});

Deno.test({
    name: 'computeIpAddressForDownload',
    fn: () => {
        const good: Record<string, string> = {
            '::': '0000:0000:0000:0000:0000:0000:0000:0000',
            '2b68:735b:d7da:025d:05d2:dad1:9215:561b': '2b68:735b:d7da:025d:0000:0000:0000:0000',
            'ff01::101': 'ff01:0000:0000:0000:0000:0000:0000:0000',
            '0000:0000:0000:0000:0000:0000:0.0.0.0': '0000:0000:0000:0000:0000:0000:0000:0000',
            '::13.1.68.3': '0000:0000:0000:0000:0000:0000:0000:0000',
            '::ffff:129.144.52.38': '0000:0000:0000:0000:0000:0000:0000:0000',
        };
        for (const [ input, expected ] of Object.entries(good)) {
            assertEquals(computeIpAddressForDownload(input), expected, input);
        }
    }
});
