import { newTextResponse, newXmlResponse } from '../responses.ts';

export function computeRobotsTxtResponse(opts: { origin: string }): Response {
    const { origin } = opts;
    const lines = [
        `User-agent: *`, 
        `Disallow: /e/`,
        `Disallow: /api/1/`,
        `Sitemap: ${origin}/sitemap.xml`,
    ];
    return newTextResponse(lines.join('\n'));
}

export function computeSitemapXmlResponse(opts: { origin: string }): Response {
    const { origin } = opts;

    const pathnames = [
        '/',
        '/releases',
        '/api/docs',
        '/terms',
        '/privacy',
        '/costs',
    ];
    const lines = [ 
        `<?xml version="1.0" encoding="utf-8" standalone="yes"?>`, 
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, 
        ...pathnames.map(v => `<url><loc>${origin}${v}</loc></url>`),
        '</urlset>',
    ];
    return newXmlResponse(lines.join('\n'));
}
