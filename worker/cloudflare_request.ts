import { IncomingRequestCf } from './deps.ts';
import { ZIPCODES } from './zipcodes.ts';

export function computeRawIpAddress(headers: Headers, header = 'cf-connecting-ip'): string | undefined {
    // e.g. 1.1.1.1
    // e.g. 1.1.1.1, 2.2.2.2
    return (headers.get(header) ?? '')
        .split(',')
        .map(v => v.trim())
        .filter(v => v !== '')
        .at(0);
}

export function computeOther(request: Request): Record<string, string> | undefined {
    const req = request as IncomingRequestCf;
    if (typeof req.cf !== 'object') return undefined;
    const rt = Object.fromEntries(Object.entries(req.cf).filter(v => /^(colo|country|continent|metroCode|region|regionCode|timezone)$/.test(v[0]) && typeof v[1] === 'string' && v[1] !== ''));
    const { asn } = req.cf;
    if (typeof asn === 'number' && Number.isInteger(asn) && asn > 0) {
        rt.asn = asn.toString();
    }
    // 2025-11-27: Cloudflare's new provider no longer provides metroCode: "Currently metroCode is not populated, but this may change in the future"
    if (rt.metroCode === undefined && rt.country === 'US' && 'postalCode' in req.cf && typeof req.cf.postalCode === 'string') {
        rt.metroCode = ZIPCODES[req.cf.postalCode];
    }
    return Object.keys(rt).length > 0 ? rt : undefined;
}

export function tryComputeColo(request: Request): string | undefined {
    const req = request as IncomingRequestCf;
    if (typeof req.cf !== 'object') return undefined;
    const { colo } = req.cf;
    return typeof colo === 'string' && colo !== '' ? colo : undefined;
}
