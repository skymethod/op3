import { KeyKind } from './rpc_model.ts';
import { isValidTimestamp } from './timestamp.ts';
import { getOrInit } from './maps.ts';

export class KeyClient {
    private readonly keyIdsByKindByDay = new Map<KeyKind, Map<string, string>>();
    private readonly keysById = new Map<string, Key>();
    private readonly keyFetcher: KeyFetcher;

    constructor(keyFetcher: KeyFetcher) {
        this.keyFetcher = keyFetcher;
    }

    async getKey(keyKind: KeyKind, timestamp: string, id?: string): Promise<Key> {
        if (typeof id === 'string') {
            const key = this.keysById.get(id);
            if (key) return key;
        }
        const keyIdsByDay = getOrInit(this.keyIdsByKindByDay, keyKind, () => new Map<string, string>());

        if (timestamp.length < 8) throw new Error(`Bad timestamp: ${timestamp}`); // faster than validation regex below
        const day = `20${timestamp.substring(0, 6)}`;
        const keyId = keyIdsByDay.get(day);
        if (keyId) {
            const key = this.keysById.get(keyId);
            if (key) return key;
        }

        if (!isValidTimestamp(timestamp)) throw new Error(`Bad timestamp: ${timestamp}`);
        const key = await this.keyFetcher(keyKind, timestamp, id);
        this.keysById.set(key.id, key);
        keyIdsByDay.set(day, key.id);
        return key;
    }

    invalidate() {
        this.keyIdsByKindByDay.clear();
        this.keysById.clear();
    }

}

export type Key = { id: string, key: CryptoKey };
export type KeyFetcher = (keyKind: KeyKind, timestamp: string, id?: string) => Promise<Key>;
