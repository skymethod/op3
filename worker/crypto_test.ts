import { assert, assertMatch, assertEquals, assertNotEquals, assertRejects } from './tests/deps.ts';
import { decrypt, encrypt, generateAesKeyBytes, generateHmacKeyBytes, hmac, importAesKey, importHmacKey } from './crypto.ts';
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

Deno.test({
    name: 'aes',
    fn: async () => {
        const keyBytes = await generateAesKeyBytes();
        const key = await importAesKey(keyBytes);

        const rawIpAddress = '1.2.3.4';
        const { encrypted, iv } = await encrypt(Bytes.ofUtf8(rawIpAddress), key);

        assertMatch(iv.hex(), /^[0-9a-f]{24}$/); 
        assertMatch(encrypted.hex(), /^[0-9a-f]{46}$/);

        assertEquals((await decrypt(encrypted, iv, key)).utf8(), rawIpAddress);

        const { encrypted: encrypted2, iv: iv2 } = await encrypt(Bytes.ofUtf8('1.2.3.5'), key);
        assertNotEquals(iv2.hex(), iv.hex());
        assertNotEquals(encrypted2.hex(), encrypted.hex());

        assertRejects(async () => await decrypt(encrypted, iv2, key));
        assertNotEquals((await encrypt(Bytes.ofUtf8(rawIpAddress), key)).iv.hex(), iv.hex());
    }
});
