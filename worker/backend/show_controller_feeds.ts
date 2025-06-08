import { packError } from '../errors.ts';
import { ErrorInterface } from '../errors.ts';
import { computeTimestamp } from '../timestamp.ts';
import { isXfetchCandidate, Xfetcher, XResponse } from '../xfetcher.ts';
import { FetchInfo, ResponseInfo } from './show_controller_model.ts';

export function tryParseBlobKey(body: string): string | undefined {
    const m = /^bk0:(.+?)$/.exec(body);
    return m ? m[1] : undefined;
}

type BlobsPut = (key: string, body: ReadableStream<Uint8Array> | ArrayBuffer | string) => Promise<{ etag: string }>;

export async function computeFetchInfo(url: string, headers: Headers, blobKeyBase: string, blobs: { put: BlobsPut }, xfetcher: Xfetcher | undefined ): Promise<FetchInfo> {
    if (blobKeyBase.includes('.')) throw new Error(`Bad blobKeyBase: ${blobKeyBase}`);

    const requestInstant = new Date().toISOString();
    let error: ErrorInterface | undefined;
    let res: Response | XResponse;
    let buffer: ArrayBuffer;
    let body: string | undefined;
    let bodyLength: number | undefined;
    let responses: ResponseInfo[] | undefined;
    const log: string[] = [];
    log.push([...headers].map(v => v.join(': ')).join(', '));

    const fetchUrls = new Set<string>();
    try {
        let redirectNum = 0;
        let fetchUrl = url;
        while (true) {
            fetchUrls.add(fetchUrl);
            res = await fetch(fetchUrl, { headers, redirect: 'manual' });
            responses = responses ?? [];
            const { url, status } = res;
            responses.push({ url, status });
            if (xfetcher && isXfetchCandidate(res as Response)) {
                res = await xfetcher(fetchUrl, { headers, redirect: 'manual' });
                const { url, status } = res;
                responses.push({ url, status, fetcher: 'xfetcher' });
            }
            const location = res.headers.get('location');
            log.push(`${fetchUrl} ${url} ${status} ${[...res.headers].map(v => v.join(': ')).join(', ')}`);
            if (typeof location === 'string' && (status === 301 || status === 302 || status === 307 || status === 308)) {
                log.push(await res.text());
                if (redirectNum >= 10) throw new Error(`Max ${redirectNum} redirects reached`);
                fetchUrl = new URL(location, url).toString();
                if (fetchUrls.has(fetchUrl)) throw new Error(`Redirect loop!`);
                redirectNum++;
            } else {
                break;
            }
        }

        // TypeError: Provided readable stream must have a known length (request/response body or readable half of FixedLengthStream)
        // not really possible to stream arbitrary responses directly to R2, so buffer it all for now
        // nice side-effect is that we can catch response stream read errors in the same place as other fetch errors
        buffer = await res.arrayBuffer();
    } catch (e) {
        const responseInstant = new Date().toISOString();
        error = packError(e);
        return { requestInstant, responseInstant, error, responses, log };
    }

    const responseInstant = new Date().toISOString();
    const { status } = res;
    const interestingHeaders = trimToInterestingHeaders(res.headers);
    const blobKey = [ '1', blobKeyBase, computeTimestamp(responseInstant), status ].join('.');
    if (buffer.byteLength > 0) {
        await blobs.put(blobKey, buffer);
        body = `bk0:${blobKey}`;
        bodyLength = buffer.byteLength;
    }

    return { requestInstant, responseInstant, status, headers: interestingHeaders, body, bodyLength, responses }; 
}

export function trimToInterestingHeaders(headers: Headers): string[][] {
    const rt: string[][] = [];
    for (const [ name, value ] of headers) {
        const nameLower = name.toLowerCase();
        if (nameLower === 'server') continue; // always cloudflare on workers
        if (nameLower === 'cf-cache-status') continue; // from cf, not origin
        if (nameLower === 'cf-ray') continue; // from cf, not origin
        if (nameLower === 'connection') continue; // who cares
        rt.push([ nameLower, value ]);
    }
    return rt;
}
