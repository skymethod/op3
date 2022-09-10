
// 220910200920153
// for 2022-09-10T20:09:20.153Z

export function isValidTimestamp(timestamp: string): boolean {
    return /^\d{15}$/.test(timestamp);
}

export function computeTimestamp(time: number | Date | string = Date.now()): string {
    const instant = typeof time === 'number' ? new Date(time).toISOString() 
        : typeof time === 'string' ? time 
        : time.toISOString();
    const m = /^(\d{2})(\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.exec(instant);
    if (!m || m[1] !== '20') throw new Error(`Bad time: ${time} ${typeof time}`);
    return m.slice(2, 9).join('');
}

export function timestampToEpochMillis(timestamp: string): number {
    return new Date(timestampToInstant(timestamp)).getTime();
}

export function timestampToInstant(timestamp: string): string {
    if (!isValidTimestamp(timestamp)) throw new Error(`Bad timestamp: ${timestamp}`);
    return `20${timestamp.slice(0, 2)}-${timestamp.slice(2, 4)}-${timestamp.slice(4, 6)}T${timestamp.slice(6, 8)}:${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}.${timestamp.slice(12, 15)}Z`;
}
