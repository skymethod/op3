import { IncomingRequestCf } from './deps.ts';

export function computeRawIpAddress(request: Request): string | undefined {
    // e.g. 1.1.1.1
    // e.g. 1.1.1.1, 2.2.2.2
    return (request.headers.get('cf-connecting-ip') ?? '')
        .split(',')
        .map(v => v.trim())
        .filter(v => v !== '')
        .at(0);
}


export function computeOther(request: Request): Record<string, string> | undefined {
    const req = request as IncomingRequestCf;
    if (typeof req.cf !== 'object') return undefined;
    const rt = Object.fromEntries(Object.entries(req.cf).filter(v => /^(colo|country)$/.test(v[0]) && typeof v[1] === 'string' && v[1] !== ''));
    return Object.keys(rt).length > 0 ? rt : undefined;
}

export function computeColo(request: Request): string | undefined {
    return (computeOther(request) ?? {}).colo;
}
