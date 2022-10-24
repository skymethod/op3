import { isValidGuid } from '../check.ts';

export function tryParsePrefixArguments(url: string, { origin }: { origin: string }): Record<string, string> | undefined {
    // not necessarily an inbound url, could be from an external notification with op3 somewhere in the middle of the redirect chain
    const host = new URL(origin).host; // hostname:port (if present)
    const m = new RegExp(`/${host}/e,(pg)(=|%3[Dd])([0-9A-Fa-f-]+)/`).exec(url);
    if (m) {
        const [ _, name, _op, value ] = m;
        if (name === 'pg') {
            const pg = value.toLowerCase();
            if (isValidGuid(pg)) {
                return { pg };
            }
        }
    }
    return undefined;
}
