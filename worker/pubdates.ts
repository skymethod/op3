
// nowhere near comprehensive, but good enough for feed analysis
export function parsePubdate(pubdate: string): string /*instant*/ {
    // Tue, 09 Nov 2021 17:08:12 GMT
    // Fri, 10 Jul 2020 06:00:00 -0000
    // 2022-10-13T14:56:23-07:00
    // Sun, 4 Dec 2022 14:30:00 CEST   tricky: found in the wild, but CEST (summer time) is not observed in december!  pick Europe/Berlin
    // 2023-07-17 12:00:00 +0000
    // 02/03/2023 06:34:00
    // 2023-09-05 01:59:37
    // Wed, 19 Jul 2023 22:48:03 Z
    // Wed, 5 Jun 2019 00:00:00 +0000Wed, 19 Apr 2023 14:14:14 +1100
    // Sun, 30 Sep 2018 00:00,00 +0000
    // Wed, 06 Sep 2023 17:37,53 +0000
    // Fri, 01 Sep 2023 19:15:00, GMT+3
    // 2024-11-21
    // 2020-10-9

    if (/^\d{4}-\d{2}-\d$/.test(pubdate)) pubdate = `${pubdate.substring(0, 8)}0${pubdate.substring(8)}T00:00:00.000Z`;
    if (/^\d{4}-(0[1-9]|1[012])-\d{2}$/.test(pubdate)) pubdate = `${pubdate}T00:00:00.000Z`;

    if (!/[a-z+/:]+/i.test(pubdate)) throw new Error(`Unsupported pubdate: ${pubdate}`);

    // Fri, 27 Jan 2017 22:36:00 CST 01:00:00 CST
    let m = /^(.*?\s+\d{2}:\d{2}:\d{2}\s+[a-z]{3})\s+\d{2}:\d{2}:\d{2}\s+[a-z]{3}$/i.exec(pubdate);
    if (m) pubdate = m[1];

    // Wed, 5 Jun 2019 00:00:00 +0000Wed, 19 Apr 2023 14:14:14 +1100
    m = /^([a-z]+, \d{1,2} [a-z]+ \d{4} \d{2}:\d{2}:\d{2} \+\d{4})[a-z]{3,}.+?$/i.exec(pubdate);
    if (m) pubdate = m[1];

    // Wed, 06 Sep 2023 17:37,53 +0000
    pubdate = pubdate.replace(/ (\d{2}:\d{2}),(\d{2}) /, ' $1:$2 ');

    // Fri, 01 Sep 2023 19:15:00, GMT+3
    pubdate = pubdate.replace(/, GMT\+(\d)/, '+0$100');

    // Wed, 23 September 2020 04:58:48GMT
    pubdate = pubdate.replace(/(\d)GMT$/, '$1 GMT');

    m = /^(.+?)\s+([a-z]+)$/i.exec(pubdate);
    if (m) {
        const [ _, prefix , tz ] = m;
        if (!/^(gmt|utc|ut)$/i.test(tz)) {
            // use Intl to compute time zone offset from name
            // will be mostly accurate except right on timechange boundaries
            const timeZone = /^CEST$/.test(tz) ? 'Europe/Berlin' // central european summer time
                : /^PDT$/.test(tz) ? 'America/Los_Angeles' // pacific daylight time
                : /^EDT$/.test(tz) ? 'America/New_York' // eastern daylight time
                : /^CDT$/.test(tz) ? 'America/Chicago' // central daylight time
                : /^MDT$/.test(tz) ? 'America/Denver' // mountain daylight time
                : /^Z$/.test(tz) ? 'GMT'
                : tz;
            try {
                const formatted = new Intl.DateTimeFormat('UTC', { timeZone, timeZoneName: 'longOffset' }).format(new Date(prefix + ' GMT'));
                const offset = timeZone === 'GMT' ? '+0000' : tryParseOffset(formatted);
                if (!offset) throw new Error();
                pubdate = prefix + ' ' + offset;
            } catch {
                throw new Error(`Unsupported pubdate: ${pubdate}`);
            }
        }
    }

    if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(pubdate) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(pubdate)) {
        pubdate += ' UTC';
    }
    pubdate = pubdate.replace(' Ju1 ', ' Jul ');
    pubdate = pubdate.replace(' Dez ', ' Dec ');
    pubdate = pubdate.replace(' Abr ', ' Apr ');
    pubdate = pubdate.replace(' Ene ', ' Jan ');
    pubdate = pubdate.replace(' Dic ', ' Dec ');
    pubdate = pubdate.replace(' Ago ', ' Aug ');
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
