import { assert, assertMatch, assertEquals, assertNotEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { generateHmacKeyBytes, hmac, importHmacKey } from './crypto.ts';
import { Bytes } from './deps.ts';

Deno.test({
    name: 'hmac',
    fn: async () => {
        const keyBytes = await generateHmacKeyBytes();
        const key = await importHmacKey(keyBytes);

        const rawIpAddress = '1.2.3.4';
        const sha = (await hmac(Bytes.ofUtf8(rawIpAddress), key)).hex();
        assertMatch(sha, /^[0-9a-f]{40}$/);
        assert(!sha.includes(rawIpAddress), sha);

        const sha2 = (await hmac(Bytes.ofUtf8('1.2.3.4'), key)).hex();
        assertEquals(sha2, sha);

        const sha3 = (await hmac(Bytes.ofUtf8('1.2.3.5'), key)).hex();
        assertNotEquals(sha3, sha);
    }
});
