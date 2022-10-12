// adapted from https://github.com/pur3miish/base58-js (MIT)

export function encodeBase58(bytes: Uint8Array): string {
    const result = [];

    for (const byte of bytes) {
        let carry = byte;
        for (let j = 0; j < result.length; ++j) {
            const x: number = (base58Map[result[j]] << 8) + carry;
            result[j] = base58Chars.charCodeAt(x % 58);
            carry = (x / 58) | 0;
        }
        while (carry) {
            result.push(base58Chars.charCodeAt(carry % 58));
            carry = (carry / 58) | 0;
        }
    }

    for (const byte of bytes) {
        if (byte) { 
            break;
        } else {
            result.push('1'.charCodeAt(0));
        }
    }

    result.reverse();

    return String.fromCharCode(...result);
}

export function isValidBase58(str: string): boolean {
    return base58Pattern.test(str);
}

export function decodeBase58(str: string): Uint8Array {
    if (typeof str !== 'string' || !isValidBase58(str)) throw new Error(`Bad base58 string: ${str}`);
    const lz = str.match(/^1+/gm);
    const psz = lz ? lz[0].length : 0;
    const size = ((str.length - psz) * (Math.log(58) / Math.log(256)) + 1) >>> 0;
  
    return new Uint8Array([
        ...new Uint8Array(psz),
        ...str
            .match(/.{1}/g)!
            .map(i => base58Chars.indexOf(i))
            .reduce((acc, i) => {
                acc = acc.map(j => {
                    const x = j * 58 + i;
                    i = x >> 8;
                    return x;
                })
                return acc;
            }, new Uint8Array(size))
            .reverse()
            .filter((lastValue => value => (lastValue = lastValue || value))(0))
    ]);
}

//

const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function createBase58Map(): number[] {
    const rt = Array(256).fill(-1);
    for (let i = 0; i < base58Chars.length; ++i) {
        rt[base58Chars.charCodeAt(i)] = i;
    }
    return rt;
}

const base58Map = createBase58Map();

const base58Pattern = new RegExp(`^[${base58Chars}]+$`);
