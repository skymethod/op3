import { KeyKind } from './rpc.ts';
import { isValidTimestamp } from './timestamp.ts';

export class KeyClient {
    private readonly dailyIpAddressHmacKeys = new Map<string, CryptoKey>();
    private readonly dailyIpAddressAesKeys = new Map<string, CryptoKey>();
    private readonly keyFetcher: KeyFetcher;

    constructor(keyFetcher: KeyFetcher) {
        this.keyFetcher = keyFetcher;
    }

    async getIpAddressHmacKey(timestamp: string): Promise<CryptoKey> {
        return await getKey(timestamp, 'ip-address-hmac', this.dailyIpAddressHmacKeys, this.keyFetcher);
    }

    async getIpAddressAesKey(timestamp: string): Promise<CryptoKey> {
        return await getKey(timestamp, 'ip-address-aes', this.dailyIpAddressAesKeys, this.keyFetcher);
    }
}

export type KeyFetcher = (keyKind: KeyKind, keyScope: string) => Promise<CryptoKey>;

//

async function getKey(timestamp: string, keyKind: KeyKind, cache: Map<string, CryptoKey>, keyFetcher: KeyFetcher) {
    if (timestamp.length < 8) throw new Error(`Bad timestamp: ${timestamp}`); // faster than validation regex below
    const day = '20' + timestamp.substring(0, 6); // we'll never rotate more than once a day
    const existing = cache.get(day);
    if (existing) return existing;

    if (!isValidTimestamp(timestamp)) throw new Error(`Bad timestamp: ${timestamp}`);

    const key = await keyFetcher(keyKind, day);
    cache.set(day, key);
    return key;
}
