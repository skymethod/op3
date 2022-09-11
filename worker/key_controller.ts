import { checkMatches, isStringRecord } from './check.ts';
import { generateHmacKeyBytes, generateAesKeyBytes } from './crypto.ts';
import { Bytes, DurableObjectStorage } from './deps.ts';
import { KeyKind } from './rpc.ts';

export class KeyController {
    private readonly storage: DurableObjectStorage;
    private readonly monthlyIpAddressHmacKeys = new Map<string, Bytes>();
    private readonly monthlyIpAddressAesKeys = new Map<string, Bytes>();

    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
    }

    async getOrGenerateKey(keyKind: KeyKind, keyScope: string): Promise<Bytes> {
        const { storage } = this;

        if (keyKind === 'ip-address-hmac') {
            return await getOrGenerateKey_(keyKind, 'iah', keyScope, isValidIpAddressHmacKeyScope, generateHmacKeyBytes, this.monthlyIpAddressHmacKeys, storage);
        } else if (keyKind === 'ip-address-aes') {
            return await getOrGenerateKey_(keyKind, 'iae', keyScope, isValidIpAddressAesKeyScope, generateAesKeyBytes, this.monthlyIpAddressAesKeys, storage);
        } else {
            throw new Error(`Unsupported keyKind: ${keyKind}`);
        }
    }

    async listKeys(): Promise<Record<string, unknown>[]> {
        const map = await this.storage.list({ prefix: 'k.'});
        return [...map.keys()].map(v => {
            const [ _, keyKindTag, month ] = checkMatches('key', v, /^k\.(.*?)\.(.*?)$/);
            return { keyKindTag, month };
        });
    }
}

//

export function isValidIpAddressHmacKeyScope(keyScope: string) {
    return /^\d{8}$/.test(keyScope); // yyyymmdd
}

export function isValidIpAddressAesKeyScope(keyScope: string) {
    return /^\d{8}$/.test(keyScope); // yyyymmdd
}

//

async function getOrGenerateKey_(keyKind: KeyKind, keyKindTag: string, keyScope: string, isValid: (keyScope: string) => boolean, generateNewKeyBytes: () => Promise<Bytes>, cache: Map<string, Bytes>, storage: DurableObjectStorage) {
    if (!isValid(keyScope)) throw new Error(`Unsupported keyKind for ${keyKind}: ${keyScope}`);
            
    // for now, rotate every utc month
    const month = keyScope.substring(0, 6);
    const existing = cache.get(month);
    if (existing) return existing;

    const loaded = await loadKeyBytes(keyKindTag, month, storage);
    if (loaded) {
        cache.set(month, loaded);
        return loaded;
    }

    console.log(`Generating new ${keyKind} key for ${month}`);
    const newKeyBytes = await generateNewKeyBytes();
    await saveKeyBytes(keyKindTag, month, newKeyBytes, storage);
    cache.set(month, newKeyBytes);
    return newKeyBytes;
}

async function loadKeyBytes(keyKindTag: string, month: string, storage: DurableObjectStorage): Promise<Bytes | undefined> {
    console.log(`loadKeyBytes: ${keyKindTag} ${month}`);
    const storageKey = `k.${keyKindTag}.${month}`;
    const record = await storage.get(storageKey);
    if (isStringRecord(record) && typeof record.keyBytesBase64 === 'string') {
        return Bytes.ofBase64(record.keyBytesBase64);
    }
    return undefined;
}

async function saveKeyBytes(keyKindTag: string, month: string, keyBytes: Bytes, storage: DurableObjectStorage): Promise<void> {
    console.log(`saveKeyBytes: ${keyKindTag} ${month}`);
    const storageKey = `k.${keyKindTag}.${month}`;
    const keyBytesBase64 = keyBytes.base64();
    await storage.put(storageKey, { keyBytesBase64 });
}
