export function increment(summary: Record<string, number>, key: string, delta = 1) {
    const existing = summary[key];
    summary[key] = (typeof existing === 'number' ? existing : 0) + delta;
}

export function incrementAll(summary: Record<string, number>, keysAndDeltas: Record<string, number>) {
    for (const [ key, delta ] of Object.entries(keysAndDeltas)) {
        increment(summary, key, delta);
    }
}

export function total(summary: Record<string, number>): number {
    return Object.values(summary).reduce((a, b) => a + b, 0);
}
