
// nowhere near comprehensive, but good enough for feed analysis
export function parsePubdate(pubdate: string): string /*instant*/ {
    // Tue, 09 Nov 2021 17:08:12 GMT
    // Fri, 10 Jul 2020 06:00:00 -0000
    // 2022-10-13T14:56:23-07:00
    if (!/[a-z]+/i.test(pubdate)) throw new Error(`Unsupported pubdate: ${pubdate}`);
    return new Date(pubdate).toISOString();
}
