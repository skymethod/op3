import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { tryParseRedirectRequest, computeRedirectResponse } from './redirect_episode.ts';

Deno.test({
    name: 'tryParseRedirectRequest',
    fn: () => {
        assertEquals(tryParseRedirectRequest('https://example.org/e/example.com/path/to/episode.mp3'), { targetUrl: `https://example.com/path/to/episode.mp3` });
        assertEquals(tryParseRedirectRequest('http://localhost:8080/e/example.com/path/to/episode.mp3'), { targetUrl: `https://example.com/path/to/episode.mp3` });
        assertEquals(tryParseRedirectRequest('https://example.org/'), undefined);
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
