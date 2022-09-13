import { assert, assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { generateHmacKeyBytes, importHmacKey } from './crypto.ts';
import { KeyClient, KeyFetcher } from './key_client.ts';
import { computeTimestamp, timestampToYyyymmdd } from './timestamp.ts';

Deno.test({
    name: 'KeyClient',
    fn: async () => {
        const hmac1 = { id: '1', key: await importHmacKey(await generateHmacKeyBytes()) };
        const hmac2 = { id: '2', key: await importHmacKey(await generateHmacKeyBytes()) };
        const hmac3 = { id: '3', key: await importHmacKey(await generateHmacKeyBytes()) };
        let world = 1;
        let keyFetcherCalled = false;
        const keyFetcher: KeyFetcher = async (keyKind, timestamp, _id) => {
            keyFetcherCalled = true;
            await Promise.resolve();
            const day = timestampToYyyymmdd(timestamp);
            if (day === '20220913' && keyKind === 'ip-address-hmac' && world === 1) return hmac1;
            if (day === '20220913' && keyKind === 'ip-address-hmac' && world === 2) return hmac3;
            if (day === '20220914' && keyKind === 'ip-address-hmac') return hmac2;
            throw new Error();
        }
        const keyClient = new KeyClient(keyFetcher);
        let k = await keyClient.getKey('ip-address-hmac', computeTimestamp('2022-09-13T21:51:31.253Z'));
        assertEquals(k, hmac1);
        assert(keyFetcherCalled); keyFetcherCalled = false;
        k = await keyClient.getKey('ip-address-hmac', computeTimestamp('2022-09-13T21:51:31.253Z'));
        assertEquals(k, hmac1);
        assert(!keyFetcherCalled);
        k = await keyClient.getKey('ip-address-hmac', computeTimestamp('2022-09-13T00:51:31.253Z'));
        assertEquals(k, hmac1);
        assert(!keyFetcherCalled);

        k = await keyClient.getKey('ip-address-hmac', computeTimestamp('2022-09-14T21:51:31.253Z'));
        assertEquals(k, hmac2);
        assert(keyFetcherCalled); keyFetcherCalled = false;

        world = 2;
        keyClient.invalidate();

        k = await keyClient.getKey('ip-address-hmac', computeTimestamp('2022-09-13T21:51:31.253Z'));
        assertEquals(k, hmac3);
        assert(keyFetcherCalled); keyFetcherCalled = false;
    }
});
