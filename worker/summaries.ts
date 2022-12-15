export function increment(summary: Record<string, number>, key: string, delta = 1) {
    if (summary[key] === undefined) summary[key] = 0;
    summary[key] += delta;
}

export function incrementAll(summary: Record<string, number>, keysAndDeltas: Record<string, number>) {
    for (const [ key, delta ] of Object.entries(keysAndDeltas)) {
        increment(summary, key, delta);
    }
}
