import { hmacForSecret } from './crypto.ts';
import { Bytes, sortBy } from './deps.ts';

export async function computeSessionToken(claims: Record<string, string>, secret: string): Promise<string> {
    if (claims.v !== undefined) throw new Error(`Claims must not include 'v'`);
    if (claims.sig !== undefined) throw new Error(`Claims must not include 'sig'`);
    const sig = (await hmacForSecret(Bytes.ofUtf8(computeCanonicalPayload(claims)), Bytes.ofUtf8(secret))).hex();
    const signed = { ...claims, sig, v: '1' };
    return Bytes.ofUtf8(JSON.stringify(signed)).base64();
}

export async function validateSessionToken(sessionToken: string, secret: string): Promise<Record<string, string>> {
    const signed = JSON.parse(Bytes.ofBase64(sessionToken).utf8());
    const { v, sig } = signed;
    if (typeof v !== 'string') throw new Error(`Expected version`);
    if (v === '1') {
        if (typeof sig !== 'string') throw new Error(`Expected sig`);
        delete signed.v;
        delete signed.sig;
        const computedSig = (await hmacForSecret(Bytes.ofUtf8(computeCanonicalPayload(signed)), Bytes.ofUtf8(secret))).hex();
        if (computedSig !== sig) throw new Error(`Bad signature`);
        return signed;
    } else {
        throw new Error(`Unsupported version: ${v}`);
    }
}

export async function tryValidateSessionToken(sessionToken: string, secret: string): Promise<Record<string, string> | undefined> {
    try {
        return await validateSessionToken(sessionToken, secret);
    } catch {
        // noop
    }
}

//

function computeCanonicalPayload(claims: Record<string, string>): string {
    return JSON.stringify(Object.fromEntries(sortBy(Object.entries(claims), v => v[0])));
}
