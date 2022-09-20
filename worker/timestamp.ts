
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

export function timestampToYyyymmdd(timestamp: string): string {
    if (!isValidTimestamp(timestamp)) throw new Error(`Bad timestamp: ${timestamp}`);
    return `20${timestamp.substring(0, 6)}`;
}

export function computeRfc822(instant: string): string {
    // Wed, 02 Oct 2002 13:00:00 GMT
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', hourCycle: 'h24', minute: '2-digit', second: '2-digit', timeZone: 'UTC' };
    const dateTimeFormat = new Intl.DateTimeFormat('en-US', options);
    const parts = Object.fromEntries(dateTimeFormat.formatToParts(new Date(instant)).map(v => [ v.type, v.value ]));
    const { weekday, month, day, year, hour, minute, second } = parts;
    return `${weekday}, ${day} ${month} ${year} ${hour}:${minute}:${second} GMT`;
}

export function addDays(date: Date, days: number): Date {
    const rt = new Date(date);
    rt.setDate(rt.getDate() + days);
    return rt;
}
