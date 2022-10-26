import { packError } from '../errors.ts';
import { ErrorInterface } from '../errors.ts';
import { computeTimestamp } from '../timestamp.ts';
import { Blobs } from './blobs.ts';
import { FetchInfo } from './show_controller_model.ts';

export function tryParseBlobKey(body: string): string | undefined {
    const m = /^bk0:(.+?)$/.exec(body);
    return m ? m[1] : undefined;
}

export async function computeFetchInfo(url: string, headers: Headers, blobKeyBase: string, blobs: Blobs): Promise<FetchInfo> {
    if (blobKeyBase.includes('.')) throw new Error(`Bad blobKeyBase: ${blobKeyBase}`);

    const requestInstant = new Date().toISOString();
    let error: ErrorInterface | undefined;
    let res: Response;
    let buffer: ArrayBuffer;
    let body: string | undefined;
    let bodyLength: number | undefined;

    try {
        res = await fetch(url, { headers });

        // TypeError: Provided readable stream must have a known length (request/response body or readable half of FixedLengthStream)
        // not really possible to stream arbitrary responses directly to R2, so buffer it all for now
        // nice side-effect is that we can catch response stream read errors in the same place as other fetch errors
        buffer = await res.arrayBuffer();
    } catch (e) {
        const responseInstant = new Date().toISOString();
        error = packError(e);
        return { requestInstant, responseInstant, error };
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

    return { requestInstant, responseInstant, status, headers: interestingHeaders, body, bodyLength }; 
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
