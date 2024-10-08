export function check<T>(name: string, value: T, isValid: boolean | ((value: T) => boolean)): boolean {
    const valid = typeof isValid === 'boolean' && isValid || typeof isValid === 'function' && isValid(value);
    if (!valid) throw new Error(`Bad ${name}: ${value}`);
    return true;
}

export function checkAll<T>(name: string, values: T[], isValid: boolean | ((value: T) => boolean)): boolean {
    values.forEach((value, i) => {
        const valid = typeof isValid === 'boolean' && isValid || typeof isValid === 'function' && isValid(value);
        if (!valid) throw new Error(`Bad ${name}[${i}]: ${value}`);
    })
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
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(instant);
}

export function tryNormalizeInstant(instantWithVariableDecimals: string): string | undefined {
    const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?Z$/.exec(instantWithVariableDecimals);
    return m ? `${m[1]}${(m[2] ?? '.000').substring(0, 4).padEnd(4, '0')}Z` : undefined;
}

export function isValidHour(hour: unknown): boolean {
    return typeof hour === 'string' && /^2\d{3}-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])T([0-1][0-9]|2[0-3])$/.test(hour);
}

export function isValidDate(date: unknown): boolean {
    return typeof date === 'string' && /^2\d{3}-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])$/.test(date);
}

export function isValidMonth(month: string): boolean {
    return /^2\d{3}-(0[1-9]|1[012])$/.test(month);
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

// deno-lint-ignore no-explicit-any
export function tryParseJson(text: string): any | undefined {
    try {
        return JSON.parse(text);
    } catch  {
        return undefined;
    }
}

export function isValidOrigin(origin: string): boolean {
    const u = tryParseUrl(origin);
    return u !== undefined && u.origin === origin;
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

export function isValidGuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(str);
}

export function isString(obj: unknown): obj is string {
    return typeof obj === 'string';
}

export function undefinedIfBlank(v: string): string | undefined {
    return v === '' ? undefined : v;
}

export function isOptionalString(obj: unknown): obj is string | undefined {
    return obj === undefined || typeof obj === 'string';
}
