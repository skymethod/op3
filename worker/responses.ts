export function newJsonResponse(obj: unknown, status = 200): Response {
    return new Response(JSON.stringify(obj, undefined, 2), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

export function newForbiddenJsonResponse() {
    return newJsonResponse({ error: 'forbidden' }, 403);
}

export function newMethodNotAllowedResponse(method: string): Response {
    return new Response(`${method} not allowed`, { status: 405, headers: { 'access-control-allow-origin': '*' } });
}

export function newRssResponse(string: string): Response {
    return new Response(string, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'access-control-allow-origin': '*' } });
}

export function newTextResponse(string: string, status = 200): Response {
    return new Response(string, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' } });
}

export function newXmlResponse(string: string): Response {
    return new Response(string, { headers: { 'content-type': 'application/xml; charset=utf-8', 'access-control-allow-origin': '*' } });
}
