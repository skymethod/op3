import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { tryParseRedirectRequest, computeRedirectResponse } from './redirect_episode.ts';

Deno.test({
    name: 'tryParseRedirectRequest',
    fn: () => {
        const good = {
            'https://example.org/e/example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
            'http://localhost:8080/e/example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
            'http://example.org/e/example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
            'https://example.org/e/http://example.com/path/to/episode.mp3': 'http://example.com/path/to/episode.mp3',
            'https://example.org/e/https://example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
            'https://example.org/e/example.com/path/to/episode.mp3?foo=bar': 'https://example.com/path/to/episode.mp3?foo=bar',
        }
        for (const [ requestUrl, expectedTargetUrl ] of Object.entries(good)) {
            assertEquals(tryParseRedirectRequest(requestUrl), { targetUrl: expectedTargetUrl });
        }

        const bad = [ 
            'https://example.org/',
            'https://example.org/e/',
            'https://example.org/e/https://',
            'https://example.org/favicon.ico',
            '',
            'asdf',
            'https://example.org/example.com/path/to/episode.mp3', 
            'https://example.org/f/example.com/path/to/episode.mp3',
            'https://example.org//e/example.com/path/to/episode.mp3',
        ];
        for (const requestUrl of bad) {
            assertEquals(tryParseRedirectRequest(requestUrl), undefined);
        }
    }
});

Deno.test({
    name: 'computeRedirectResponse',
    fn: () => {
        const targetUrl = `https://example.com/path/to/episode.mp3`;
        const res = computeRedirectResponse({ targetUrl });
        assertEquals(res.status, 302);
        assertEquals(res.headers.get('location'), targetUrl);
        assertEquals(res.headers.get('cache-control'), 'private, no-cache');
    }
});
