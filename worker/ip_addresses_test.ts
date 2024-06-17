import { assertEquals, assert } from './tests/deps.ts';
import { Bytes } from './deps.ts';
import { computeIpAddressForDownload, computeListenerIpAddress, packHashedIpAddress, tryExpandIpv6, unpackHashedIpAddressHash } from './ip_addresses.ts';

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

Deno.test({
    name: 'computeListenerIpAddress',
    fn: () => {
        assertEquals(computeListenerIpAddress({ rawIpAddress: undefined, xForwardedFor: undefined, asn: undefined, userAgent: undefined }), { listenerIpAddress: undefined, usedXForwardedFor: false });
        assertEquals(computeListenerIpAddress({ rawIpAddress: '1.2.3.4', xForwardedFor: undefined, asn: undefined, userAgent: undefined }), { listenerIpAddress: '1.2.3.4', usedXForwardedFor: false });
        assertEquals(computeListenerIpAddress({ rawIpAddress: '1.2.3.4', xForwardedFor: '2.3.4.5', asn: undefined, userAgent: undefined }), { listenerIpAddress: '1.2.3.4', usedXForwardedFor: false });
        assertEquals(computeListenerIpAddress({ rawIpAddress: '1.2.3.4', xForwardedFor: '2.3.4.5', asn: undefined, userAgent: 'Mozilla/5.0 (Cloud Phone; Nokia 110 4G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.111 Mobile Safari/537.36 Puffin/12.1.1.46653FP PodLP/1.0' }), { listenerIpAddress: '1.2.3.4', usedXForwardedFor: false });
        assertEquals(computeListenerIpAddress({ rawIpAddress: '1.2.3.4', xForwardedFor: '2.3.4.5', asn: 123, userAgent: 'Mozilla/5.0 (Cloud Phone; Nokia 110 4G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.111 Mobile Safari/537.36 Puffin/12.1.1.46653FP PodLP/1.0' }), { listenerIpAddress: '1.2.3.4', usedXForwardedFor: false });
        assertEquals(computeListenerIpAddress({ rawIpAddress: '1.2.3.4', xForwardedFor: '2.3.4.5', asn: 174, userAgent: 'Mozilla/5.0 (Cloud Phone; Nokia 110 4G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.111 Mobile Safari/537.36 Puffin/12.1.1.46653FP PodLP/1.0' }), { listenerIpAddress: '2.3.4.5', usedXForwardedFor: true });
        assertEquals(computeListenerIpAddress({ rawIpAddress: '1.2.3.4', xForwardedFor: '2.3.4.5', asn: 174, userAgent: 'Mozilla/5.0 (Nokia 110 4G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.111 Mobile Safari/537.36 Puffin/12.1.1.46653FP PodLP/1.0' }), { listenerIpAddress: '1.2.3.4', usedXForwardedFor: false });
    }
});