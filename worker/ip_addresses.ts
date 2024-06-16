import { Bytes } from './deps.ts';

export function packHashedIpAddress(keyId: string, signature: Bytes): string {
    return `2:${keyId}:${signature.hex()}`;
}

export function unpackHashedIpAddressHash(packedHashedIpAddress: string): string {
    const m2 = /^2:(.+?):([0-9a-f]+)$/.exec(packedHashedIpAddress);
    if (m2) return m2[2];
    const m1 = /^1:([0-9a-f]+)$/.exec(packedHashedIpAddress);
    if (m1) return m1[1];
    throw new Error(`Bad packedHashedIpAddress: ${packedHashedIpAddress}`);
}

export function computeIpAddressForDownload(rawIpAddress: string): string {
    // for ipv6 addresses, take only the first 64 bits (8 bytes)
    const expanded = tryExpandIpv6(rawIpAddress);
    if (typeof expanded === 'string') {
        return `${expanded.substring(0, 19)}:0000:0000:0000:0000`;
    }
    return rawIpAddress;
}

export function tryExpandIpv6(rawIpAddress: string): string | undefined {
    // :: -> 0000:0000:0000:0000:0000:0000:0000:0000
    if (!/^[0-9a-f:.]{2,}$/.test(rawIpAddress)) return undefined;
    const m = /^(.+?):(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(rawIpAddress);
    if (m) rawIpAddress = `${m[1]}:${decimalToHex(m[2])}${decimalToHex(m[3])}:${decimalToHex(m[4])}${decimalToHex(m[5])}`; // ::1.2.3.4 -> ::0000:0000:0102:0304
    const [ left, right = '' ] = rawIpAddress.split('::');
    const leftParts = left.split(':').filter(v => v.length > 0).map(v => v.padStart(4, '0'));
    const rightParts = right.split(':').filter(v => v.length > 0).map(v => v.padStart(4, '0'));
    const midParts = new Array(8 - leftParts.length - rightParts.length).fill('0000');
    const parts = [ ...leftParts, ...midParts, ...rightParts ];
    const rt = parts.join(':');
    return /^[0-9a-f]{4}(:[0-9a-f]{4}){7}$/.test(rt) ? rt : undefined;
}

export function computeListenerIpAddress({ rawIpAddress, xForwardedFor, asn, userAgent }: { rawIpAddress: string | undefined, xForwardedFor: string | undefined, asn: number | undefined, userAgent: string | undefined }): { listenerIpAddress: string | undefined, usedXForwardedFor: boolean } {
    if (typeof xForwardedFor === 'string' && typeof userAgent === 'string') {
        if (/cloud phone/i.test(userAgent) && asn === 174) { // 2024-06-16: Mozilla/5.0 (Cloud Phone; Nokia 110 4G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.111 Mobile Safari/537.36 Puffin/12.1.1.46653FP PodLP/1.0
            return { listenerIpAddress: xForwardedFor, usedXForwardedFor: true };
        }
    }
    return { listenerIpAddress: rawIpAddress, usedXForwardedFor: false };
}

//

function decimalToHex(decimal: string): string {
    return parseInt(decimal).toString(16).padStart(2, '0');
}
