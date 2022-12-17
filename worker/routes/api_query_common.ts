import { tryNormalizeInstant,check,isValidInstant,tryParseInt,checkMatches, isValidDate } from '../check.ts';
import { tryParseDurationMillis } from '../duration.ts';

export type ApiQueryCommonParameters = { readonly limit: number, readonly startTimeInclusive?: string, readonly startTimeExclusive?: string, readonly endTimeExclusive?: string, readonly format?: string };

export function computeApiQueryCommonParameters(searchParams: URLSearchParams, { limitDefault, limitMin, limitMax }: { limitDefault: number, limitMin: number, limitMax: number }): ApiQueryCommonParameters {
    const { start, startAfter, end, limit, format } = Object.fromEntries(searchParams);

    const checkTime = (name: string, value: string) => {
        const duration = tryParseDurationMillis(value);
        if (typeof duration === 'number') {
            value = new Date(Date.now() + duration).toISOString();
        }
        if (isValidDate(value)) value = `${value}T00:00:00.000Z`;
        const norm = tryNormalizeInstant(value);
        if (norm) value = norm;
        check(name, value, isValidInstant);
        return value;
    }
    let rt: ApiQueryCommonParameters = { limit: limitDefault };

    if (typeof start === 'string' && typeof startAfter === 'string') throw new Error(`Specify either 'start' or 'startAfter', not both`);
    if (typeof start === 'string') {
        rt = { ...rt, startTimeInclusive: checkTime('start', start) };
    }
    if (typeof startAfter === 'string') {
        rt = { ...rt, startTimeExclusive: checkTime('startAfter', startAfter) };
    }
    if (typeof end === 'string') {
        rt = { ...rt, endTimeExclusive: checkTime('end', end) };
    }
    if (typeof limit === 'string') {
        const lim = tryParseInt(limit);
        if (lim === undefined || lim < limitMin || lim > limitMax) throw new Error(`Bad limit: ${limit}`);
        rt = { ...rt, limit: lim };
    }
    if (typeof format === 'string') {
        checkMatches('format', format, /^(tsv|json|json-o|json-a)$/);
        rt = { ...rt, format };
    }    

    return rt;
}

export function newQueryResponse({ startTime, format, headers, rows }: { startTime: number, format: string, headers: string[], rows: unknown[] }): Response {
    const queryTime = Date.now() - startTime;
    const count = rows.length;
    if (format === 'tsv') {
        rows.unshift(headers.join('\t'));
        return new Response(rows.join('\n'), { headers: { 'content-type': 'text/tab-separated-values', 'x-query-time': queryTime.toString(), 'access-control-allow-origin': '*' } });
    }
    const obj = format === 'json-a' ? { headers, rows, count, queryTime } : { rows, count, queryTime };
    return new Response(JSON.stringify(obj, undefined, 2), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}
