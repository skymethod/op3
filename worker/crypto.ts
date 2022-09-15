import { Bytes } from './deps.ts';

export function isValidSha256Hex(str: string): boolean {
    return /^[0-9a-f]{64}$/.test(str);
}

// hmac sha-1

export async function generateHmacKeyBytes(): Promise<Bytes> {
    const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-1' }, true, [ 'sign', 'verify' ]);
    return await exportKeyBytes(key);
}

export async function importHmacKey(keyBytes: Bytes): Promise<CryptoKey> {
    return await crypto.subtle.importKey('raw', keyBytes.array(), { name: 'HMAC', hash: { name: 'SHA-1' } }, false, [ 'sign', 'verify' ]);
}

export async function hmac(data: Bytes, key: CryptoKey): Promise<Bytes> {
    const signature = await crypto.subtle.sign({ name: 'HMAC'}, key, data.array());
    return new Bytes(new Uint8Array(signature));
}

export function isValidSha1Hex(str: string): boolean {
    return /^[0-9a-f]{40}$/.test(str);
}

// aes-gcm 256

export async function generateAesKeyBytes(): Promise<Bytes> {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [ 'encrypt', 'decrypt' ]);
    return await exportKeyBytes(key);
}

export async function importAesKey(keyBytes: Bytes): Promise<CryptoKey> {
    return await crypto.subtle.importKey('raw', keyBytes.array(), { name: 'AES-GCM' }, false, [ 'encrypt', 'decrypt' ]);
}

export async function encrypt(data: Bytes, key: CryptoKey): Promise<{ encrypted: Bytes, iv: Bytes }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data.array());
    return { encrypted: new Bytes(new Uint8Array(encrypted)), iv: new Bytes(iv) };
}

export async function decrypt(encrypted: Bytes, iv: Bytes, key: CryptoKey): Promise<Bytes> {
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.array(), tagLength: 128 }, key, encrypted.array());
    return new Bytes(new Uint8Array(data));
}

//

async function exportKeyBytes(key: CryptoKey): Promise<Bytes> {
    const keyArrayBuffer = await crypto.subtle.exportKey('raw', key);
    return new Bytes(new Uint8Array(keyArrayBuffer));
}
