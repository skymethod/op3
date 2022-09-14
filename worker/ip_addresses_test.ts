import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { Bytes } from './deps.ts';
import { packHashedIpAddress, unpackHashedIpAddressHash } from './ip_addresses.ts';

Deno.test({
    name: 'IsolateId.get',
    fn: () => {
        const signature = Bytes.ofUtf8('whatever');
        assertEquals(unpackHashedIpAddressHash(packHashedIpAddress('1', signature)), signature.hex());
    }
});
