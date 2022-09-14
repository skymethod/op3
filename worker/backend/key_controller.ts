import { isStringRecord } from '../check.ts';
import { generateHmacKeyBytes, generateAesKeyBytes } from '../crypto.ts';
import { DurableObjectStorage } from '../deps.ts';
import { tryParseInt } from '../parse.ts';
import { KeyKind } from '../rpc_model.ts';
import { timestampToYyyymmdd } from '../timestamp.ts';

export class KeyController {
    private readonly storage: DurableObjectStorage;

    private keyRecords?: Map<string, KeyRecord>;

    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
    }

    async getOrGenerateKey(keyKind: KeyKind, timestamp: string, id?: string): Promise<Key> {
        const month = timestampToYyyymmdd(timestamp).substring(0, 6);
        const keyRecords = await this.getOrLoadKeyRecords();

        if (typeof id === 'string') {
            // get an existing active or inactive key with a known id
            const keyRecord = keyRecords.get(id);
            if (keyRecord) {
                if (keyKind !== keyRecord.keyKind) throw new Error(`Key ${id} is ${keyRecord.keyKind}, not ${keyKind}`);
                if (month !== keyRecord.month) throw new Error(`Key ${id} is ${keyRecord.month}, not ${month}`);
                console.log(`KeyController: Returning existing ${keyRecord.active ? 'active' : 'inactive'} key ${keyKind} key for ${month} with id ${keyRecord.id}`);
                return computeKey(keyRecord);
            }
        }

        // no id specified, return the active one
        const active = [...keyRecords.values()].filter(v => v.month === month && v.active && v.keyKind === keyKind);
        if (active.length > 1) throw new Error(`${active.length} active ${keyKind} keys for ${month}`);
        if (active.length === 1) {
            console.log(`KeyController: Returning exiting active ${keyKind} key for ${month}`);
            return computeKey(active[0]);
        }

        // no active key, generate a new one
        console.log(`KeyController: Generating new active ${keyKind} key for ${month}`);
        const generateKeyBytes = keyKind === 'ip-address-hmac' ? generateHmacKeyBytes : keyKind === 'ip-address-aes' ? generateAesKeyBytes : undefined;
        if (generateKeyBytes === undefined) throw new Error(`Unsupported keyKind:: ${keyKind}`);
        const newKeyBytes = await generateKeyBytes();
        const newKeyRecord: KeyRecord = {
            id: computeNextKeyId(keyRecords),
            keyKind,
            month,
            active: true,
            keyBytesBase64: newKeyBytes.base64(),
        };
        await this.storage.put(`kc.k.${newKeyRecord.id}`, newKeyRecord);
        keyRecords.set(newKeyRecord.id, newKeyRecord);
        return computeKey(newKeyRecord);
    }

    async listKeys(): Promise<Record<string, unknown>[]> {
        const keyRecords = await this.getOrLoadKeyRecords();
        return [...keyRecords.values()].map(v => {
            const { id, keyKind, active, month } = v;
            return { id, keyKind, active, month };
        });
    }

    //

    private async getOrLoadKeyRecords(): Promise<Map<string,KeyRecord>> {
        if (this.keyRecords) return this.keyRecords;

        console.log('KeyController: loading key records');
        const rt = new Map<string, KeyRecord>();
        const map = await this.storage.list({ prefix: 'kc.k.'});
        for (const record of map.values()) {
            if (isValidKeyRecord(record)) {
                rt.set(record.id, record);
            }
        }
        this.keyRecords = rt;
        return rt;
    }

}

//

export interface Key {
    readonly id: string;
    readonly keyBytesBase64: string;
}

//

interface KeyRecord {
    readonly id: string;
    readonly keyKind: KeyKind;
    readonly keyBytesBase64: string;
    readonly active: boolean;
    readonly month: string; // yyyymmdd
}

//

// deno-lint-ignore no-explicit-any
function isValidKeyRecord(obj: any): obj is KeyRecord {
    return isStringRecord(obj)
        && typeof obj.id === 'string'
        && typeof obj.keyKind === 'string'
        && typeof obj.keyBytesBase64 === 'string'
        && typeof obj.active === 'boolean'
        && typeof obj.month === 'string'
}

function computeKey(keyRecord: KeyRecord): Key {
    const { id, keyBytesBase64 } = keyRecord;
    return { id, keyBytesBase64 };
}

function computeNextKeyId(keyRecords: Map<string, KeyRecord>): string {
    let maxKeyId = 0;
    for (const record of keyRecords.values()) {
        const id = tryParseInt(record.id);
        if (typeof id === 'number') {
            maxKeyId = Math.max(maxKeyId, id);
        }
    }
    return (maxKeyId + 1).toString();
}
