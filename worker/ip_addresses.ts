import { Bytes } from './deps.ts';

export function packHashedIpAddress(keyId: string, signature: Bytes): string {
    return `2:${keyId}:${signature.hex()}`;
}

export function unpackHashedIpAddressHash(packedHashedIpAddress: string): string {
    const m1 = /^1:([0-9a-f]+)$/.exec(packedHashedIpAddress);
    if (m1) return m1[1];
    const m2 = /^2:(.+?):([0-9a-f]+)$/.exec(packedHashedIpAddress);
    if (m2) return m2[2];
    throw new Error(`Bad packedHashedIpAddress: ${packedHashedIpAddress}`);
}
