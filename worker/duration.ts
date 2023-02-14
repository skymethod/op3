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

export function formatDuration(millis: number): string {
    const abs = Math.abs(millis);
    const parts = [ millis < 0 ? '-' : '' ];
    const hours = Math.floor(abs / 1000 / 60 / 60);
    if (hours > 0) parts.push(`${hours}h`);
    const minutes = Math.floor(abs / 1000 / 60) % 60;
    if (minutes > 0) parts.push(`${minutes}m`);
    const seconds = Math.floor(abs / 1000) % 60;
    if (seconds > 0 || parts.length === 1) parts.push(`${seconds}s`);
    return parts.join('');
}
