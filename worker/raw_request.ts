import { generateUuid } from './uuid.ts';

export function computeRawRequest(request: Request, opts: { time: number, method: string, rawIpAddress: string, other?: Record<string, string> }): RawRequest {
    const { time, method, rawIpAddress, other } = opts;
    const uuid = generateUuid();
    const { url } = request;
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const referer = request.headers.get('referer') ?? undefined;
    const range = request.headers.get('range') ?? undefined;
    return { uuid, time, rawIpAddress, method, url, userAgent, referer, range, other };
}

//

export interface RawRequest {
    readonly uuid: string;
    readonly time: number; // epoch millis
    readonly rawIpAddress: string;
    readonly method: string;
    readonly url: string;
    readonly userAgent?: string;
    readonly referer?: string;
    readonly range?: string;
    readonly other?: Readonly<Record<string, string>>;
}