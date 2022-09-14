export function check<T>(name: string, value: T, isValid: boolean | ((value: T) => boolean)): boolean {
    const valid = typeof isValid === 'boolean' && isValid || typeof isValid === 'function' && isValid(value);
    if (!valid) throw new Error(`Bad ${name}: ${value}`);
    return true;
}

export function checkMatches(name: string, value: string, pattern: RegExp): RegExpExecArray {
    const m = pattern.exec(value);
    if (!m) throw new Error(`Bad ${name}: ${value}`);
    return m; 
}

// deno-lint-ignore no-explicit-any
export function isStringRecord(obj: any): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}

export function isValidInstant(instant: string): boolean {
    return /^(\d{2})(\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.test(instant);
}

export function isValidHttpUrl(url: string): boolean {
    const u = tryParseUrl(url);
    return !!u && /^https?:$/.test(u.protocol);
}

export function tryParseUrl(url: string): URL | undefined {
    try {
        return new URL(url);
    } catch  {
        return undefined;
    }
}

export function tryParseInt(str: string | undefined): number | undefined {
    if (typeof str !== 'string') return undefined;
    try {
        const rt = parseInt(str);
        return Number.isInteger(rt) && rt.toString() === str ? rt : undefined;
    } catch {
        return undefined;
    }
}

export function isNotBlank(str: string): boolean {
    return str !== '';
}
