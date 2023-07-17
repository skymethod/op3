
// nowhere near comprehensive, but good enough for feed analysis
export function parsePubdate(pubdate: string): string /*instant*/ {
    // Tue, 09 Nov 2021 17:08:12 GMT
    // Fri, 10 Jul 2020 06:00:00 -0000
    // 2022-10-13T14:56:23-07:00
    // Sun, 4 Dec 2022 14:30:00 CEST   tricky: found in the wild, but CEST (summer time) is not observed in december!  pick Europe/Berlin
    // 2023-07-17 12:00:00 +0000

    if (!/[a-z+]+/i.test(pubdate)) throw new Error(`Unsupported pubdate: ${pubdate}`);

    const m = /^(.+?)\s+([a-z]+)$/i.exec(pubdate);
    if (m) {
        const [ _, prefix , tz ] = m;
        if (!/^(gmt|utc|ut)$/i.test(tz)) {
            // use Intl to compute time zone offset from name
            // will be mostly accurate except right on timechange boundaries
            const timeZone = /^CEST$/.test(tz) ? 'Europe/Berlin' // central european summer time
                : /^PDT$/.test(tz) ? 'America/Los_Angeles' // pacific daylight time
                : /^EDT$/.test(tz) ? 'America/New_York' // eastern daylight time
                : tz;
            const offset = tryParseOffset(new Intl.DateTimeFormat('UTC', { timeZone, timeZoneName: 'longOffset' }).format(new Date(prefix + ' GMT')));
            if (!offset) throw new Error(`Unsupported pubdate: ${pubdate}`);
            pubdate = prefix + ' ' + offset;
        }
    }

    try {
        return new Date(pubdate).toISOString();
    } catch {
        throw new Error(`Unsupported pubdate: ${pubdate}`);
    }
}

export function tryParsePubdate(pubdate: string): string | undefined {
    if (pubdate === '') return undefined;
    try {
        return parsePubdate(pubdate);
    } catch {
        // noop
    }
}

//

function tryParseOffset(output: string): string | undefined {
    // 12/4/2022, GMT+01:00 -> +01:00
    const m = /\s+GMT([+-]\d{2}:\d{2})$/.exec(output);
    if (m) return m[1];
}
