import { Bytes } from './deps.ts';

export async function hmac(data: Bytes, key: CryptoKey): Promise<Bytes> {
    const signature = await crypto.subtle.sign({ name: 'HMAC'}, key, data.array());
    return new Bytes(new Uint8Array(signature));
}

export async function generateHmacKeyBytes(): Promise<Bytes> {
    const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-1' }, true, [ 'sign', 'verify' ]);
    const keyArrayBuffer = await crypto.subtle.exportKey('raw', key);
    return new Bytes(new Uint8Array(keyArrayBuffer));
}

export async function importHmacKey(keyBytes: Bytes): Promise<CryptoKey> {
    return await crypto.subtle.importKey('raw', keyBytes.array(), { name: 'HMAC', hash: { name: 'SHA-1' } }, false, [ 'sign', 'verify' ]);
}
