import { isValidHttpUrl } from './check.ts';

export type Xfetcher = (url: string, opts: { headers: Headers, redirect: 'manual' }) => Promise<XResponse>;

export type XResponse = {
    url: string,
    status: number,
    headers: Headers,
    text: () => Promise<string>,
    arrayBuffer: () => Promise<ArrayBuffer>,
}

export function tryMakeXfetcher(str: string | undefined): Xfetcher | undefined {
    const [ endpoint, auth ] = (typeof str === 'string' ? str : '').split(',');
    if (typeof endpoint === 'string' && isValidHttpUrl(endpoint) && typeof auth === 'string') {
        return async (url, opts) => {
            const u = new URL(endpoint);
            u.searchParams.set('url', url);
            const headers = new Headers([ ...opts.headers ].filter(v => v[0].startsWith('x-')).map(v => [ v[0].substring(2), v[1] ]));
            headers.set('authorization', auth);
            const res = await fetch(u.toString(), { headers });
            const rt: XResponse = {
                url,
                status: res.status,
                headers: new Headers([ ...res.headers ].filter(v => v[0].startsWith('x-')).map(v => [ v[0].substring(2), v[1] ])),
                text: async () => await res.text(),
                arrayBuffer: async () => await res.arrayBuffer(),
            }
            return rt;
        }
    }
}

export function isXfetchCandidate(res: Response): boolean {
    return res.status === 202 && res.headers.get('sg-captcha') === 'challenge';
}
