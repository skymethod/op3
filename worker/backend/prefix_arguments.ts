import { isValidGuid } from '../check.ts';
import { isValidUuid } from '../uuid.ts';

export function tryParsePrefixArguments(url: string, { origin }: { origin: string }): Record<string, string> | undefined {
    // not necessarily an inbound url, could be from an external notification with op3 somewhere in the middle of the redirect chain
    const host = new URL(origin).host; // hostname:port (if present)
    const m = new RegExp(`/${host}/e((${ARGSTRING})*)/`).exec(url);
    return m ? tryParsePrefixArgumentsFromArgstring(m[1]) : undefined;
}

export function tryParsePrefixArgumentsFromArgstring(argstring: string) {
    let rt: Record<string, string> | undefined;
    if (typeof argstring === 'string') {
        for (const m2 of argstring.matchAll(ARGSTRING_PATTERN)) {
            const [_, name, _op, value] = m2;
            if (name === 'pg') {
                const pg = value.toLowerCase();
                if (isValidGuid(pg)) {
                    rt = { ...rt, pg };
                }
            } else if (name === 'hls') {
                const hls = value.toLowerCase();
                if (/^[01]$/.test(hls)) {
                    rt = { ...rt, hls };
                }
            } else if (name === 's') {
                const s = value.toLowerCase();
                if (isValidUuid(s)) {
                    rt = { ...rt, s };
                }
            } else if (name === 'p') {
                const p = value.toLowerCase();
                if (isValidUuid(p)) {
                    rt = { ...rt, p };
                }
            }
        }
    }
    return rt;
}

//

const ARGSTRING = ',(pg|hls|s|p)(=|%3[Dd])([0-9A-Fa-f-]+)';
const ARGSTRING_PATTERN = new RegExp(ARGSTRING, 'g');
