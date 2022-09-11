import { isValidTimestamp } from './timestamp.ts';

export class KeyClient {
    private readonly dailyIpAddressHmacKeys = new Map<string, CryptoKey>();
    private readonly keyFetcher: KeyFetcher;

    constructor(keyFetcher: KeyFetcher) {
        this.keyFetcher = keyFetcher;
    }

    async getIpAddressHmacKey(timestamp: string): Promise<CryptoKey> {
        if (timestamp.length < 8) throw new Error(`Bad timestamp: ${timestamp}`); // faster than validation regex below
        const day = '20' + timestamp.substring(0, 6); // we'll never rotate more than once a day
        const existing = this.dailyIpAddressHmacKeys.get(day);
        if (existing) return existing;

        if (!isValidTimestamp(timestamp)) throw new Error(`Bad timestamp: ${timestamp}`);

        const key = await this.keyFetcher('ip-address-hmac', day);
        this.dailyIpAddressHmacKeys.set(day, key);
        return key;
    }    

}

export type KeyFetcher = (keyType: string, keyScope: string) => Promise<CryptoKey>;
