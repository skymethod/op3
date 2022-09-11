import { isStringRecord } from 'https://raw.githubusercontent.com/skymethod/denoflare/v0.5.7/common/check.ts';
import { generateHmacKeyBytes } from './crypto.ts';
import { Bytes, DurableObjectStorage } from './deps.ts';

export class KeyController {
    private readonly storage: DurableObjectStorage;
    private readonly monthlyIpAddressHmacKeys = new Map<string, Bytes>();

    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
    }

    async getOrGenerateKey(keyType: string, keyScope: string): Promise<Bytes> {
        if (keyType === 'ip-address-hmac') {
            if (!isValidIpAddressHmacKeyScope(keyScope)) throw new Error(`Unsupported keyScope for ${keyType}: ${keyScope}`);
            
            const { storage } = this;

            // for now, rotate every utc month
            const month = keyScope.substring(0, 6);
            const existing = this.monthlyIpAddressHmacKeys.get(month);
            if (existing) return existing;

            const loaded = await loadKeyBytes(month, storage);
            if (loaded) {
                this.monthlyIpAddressHmacKeys.set(month, loaded);
                return loaded;
            }

            console.log(`Generating new hmac key for ${month}`);
            const newKeyBytes = await generateHmacKeyBytes();
            await saveKeyBytes(month, newKeyBytes, storage);
            this.monthlyIpAddressHmacKeys.set(month, newKeyBytes);
            return newKeyBytes;
        } else {
            throw new Error(`Unsupported keyType: ${keyType}`);
        }
    }
}

//

export function isValidIpAddressHmacKeyScope(keyScope: string) {
    return /^\d{8}$/.test(keyScope); // yyyymmdd
}

//

async function loadKeyBytes(month: string, storage: DurableObjectStorage): Promise<Bytes | undefined> {
    console.log(`loadKeyBytes: ${month}`);
    const storageKey = 'k.iah.' + month;
    const record = await storage.get(storageKey);
    if (isStringRecord(record) && typeof record.keyBytesBase64 === 'string') {
        return Bytes.ofBase64(record.keyBytesBase64);
    }
    return undefined;
}

async function saveKeyBytes(month: string, keyBytes: Bytes, storage: DurableObjectStorage): Promise<void> {
    console.log(`saveKeyBytes: ${month}`);
    const storageKey = 'k.iah.' + month;
    const keyBytesBase64 = keyBytes.base64();
    await storage.put(storageKey, { keyBytesBase64 });
}
