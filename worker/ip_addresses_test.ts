import { assertEquals } from './tests/deps.ts';
import { Bytes } from './deps.ts';
import { packHashedIpAddress, unpackHashedIpAddressHash } from './ip_addresses.ts';

Deno.test({
    name: 'IsolateId.get',
    fn: () => {
        const signature = Bytes.ofUtf8('whatever');
        assertEquals(unpackHashedIpAddressHash(packHashedIpAddress('1', signature)), signature.hex());
    }
});
