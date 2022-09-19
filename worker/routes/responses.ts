export function newJsonResponse(obj: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(obj, undefined, 2), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

export function newMethodNotAllowedResponse(method: string): Response {
    return new Response(`${method} not allowed`, { status: 405, headers: { 'access-control-allow-origin': '*' } });
}

export function newRssResponse(string: string): Response {
    return new Response(string, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'access-control-allow-origin': '*' } });
}