import { assertEquals } from '../tests/deps.ts';
import { tryParseRedirectRequest, computeRedirectResponse } from './redirect_episode.ts';

Deno.test({
    name: 'tryParseRedirectRequest',
    fn: () => {
        const good: Record<string, string | { expectedTargetUrl: string, expectedPrefixArgs: Record<string, string> }> = {
            'https://example.org/e/example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
            'http://localhost:8080/e/example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
            'http://example.org/e/example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
            'https://example.org/e/http://example.com/path/to/episode.mp3': 'http://example.com/path/to/episode.mp3',
            'https://example.org/e/https://example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
            'https://example.org/e/example.com/path/to/episode.mp3?foo=bar': 'https://example.com/path/to/episode.mp3?foo=bar',
            'https://example.org/e/https:/example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
            'https://example.org/e/us.example.com:8111/stream': 'https://us.example.com:8111/stream',
            'http://example.org:80/e/example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3', // for now, we redirect to https in this case
            'https://example.org/e,pg=fe4fb16c-062a-4257-ba8d-9a9b923356c2/example.com/path/to/episode.mp3': { expectedTargetUrl: 'https://example.com/path/to/episode.mp3', expectedPrefixArgs: { pg: 'fe4fb16c-062a-4257-ba8d-9a9b923356c2' } },
            'https://example.org/e,pg=fe4fb16c-062a-4257-ba8d-9a9b923356c2,hls=1/example.com/path/to/episode.mp3': { expectedTargetUrl: 'https://example.com/path/to/episode.mp3', expectedPrefixArgs: { pg: 'fe4fb16c-062a-4257-ba8d-9a9b923356c2', hls: '1' } },
            'https://op3.dev/e/pg=fe4fb16c-062a-4257-ba8d-9a9b923356c2/example.com/path/to/episode.mp3': { expectedTargetUrl: 'https://example.com/path/to/episode.mp3', expectedPrefixArgs: { pg: 'fe4fb16c-062a-4257-ba8d-9a9b923356c2' } }, // temporarily allowed
            'https://example.org/e,/example.com/path/to/episode.mp3': 'https://example.com/path/to/episode.mp3',
        }
        for (const [ requestUrl, expected ] of Object.entries(good)) {
            const expectedTargetUrl = typeof expected === 'string' ? expected : expected.expectedTargetUrl;
            const expectedPrefixArgs = typeof expected === 'string' ? undefined : expected.expectedPrefixArgs;
            assertEquals(tryParseRedirectRequest(requestUrl), { kind: 'valid', targetUrl: expectedTargetUrl, ...(expectedPrefixArgs && { prefixArgs: expectedPrefixArgs }) }, requestUrl);
        }

        const other = [ 
            'https://example.org/',
            'https://example.org/favicon.ico',
            '',
            'asdf',
            'https://example.org/example.com/path/to/episode.mp3', 
            'https://example.org/f/example.com/path/to/episode.mp3',
            'https://example.org//e/example.com/path/to/episode.mp3',
        ];
        for (const requestUrl of other) {
            assertEquals(tryParseRedirectRequest(requestUrl), undefined);
        }
        const bad = [
            'https://example.org/e/',
            'https://example.org/e/https://',
            'https://example.org/e/example.com',
            'https://example.org/e/example.com/',
            'https://example.org/e/f',
            'https://example.org/e/localhost',
            'https://example.org/e/localhost/foo.mp3',
            'https://example.org/e/asdf-/foo.mp3',
            'https://example.org/e/asdf../foo.mp3',
            'https://example.org/e/.asdf/foo.mp3',
        ];
        for (const requestUrl of bad) {
            assertEquals(tryParseRedirectRequest(requestUrl), { kind: 'invalid' });
        }
    }
});

Deno.test({
    name: 'computeRedirectResponse',
    fn: () => {
        const targetUrl = `https://example.com/path/to/episode.mp3`;
        const res = computeRedirectResponse({ kind: 'valid', targetUrl });
        assertEquals(res.status, 302);
        assertEquals(res.headers.get('location'), targetUrl);
        assertEquals(res.headers.get('cache-control'), 'private, no-cache');
    }
});
