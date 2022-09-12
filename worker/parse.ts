export function tryParseInt(str: string | undefined): number | undefined {
    if (typeof str !== 'string') return undefined;
    try {
        const rt = parseInt(str);
        return Number.isInteger(rt) && rt.toString() === str ? rt : undefined;
    } catch {
        // noop
    }
}
