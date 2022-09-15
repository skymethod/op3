import { tryParseInt } from './check.ts';

export function tryParseDurationMillis(duration: string): number | undefined {
    const m = /^([-+])?(\d+)([dhms])$/.exec(duration);
    if (!m) return undefined;
    const [ _, minus, quantity, unit ] = m;
    const q = tryParseInt(quantity);
    if (q === undefined) return undefined;
    const sign = minus === '-' ? -1 : 1;
    const mult = unit === 'd' ? 1000 * 60 * 60 * 24
        : unit === 'h' ? 1000 * 60 * 60
        : unit === 'm' ? 1000 * 60
        : 1000; // s
    return sign * q * mult;
}
