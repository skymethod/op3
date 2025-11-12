import { assertEquals, assertThrows } from './tests/deps.ts';
import { cleanUrl, computeMatchUrl, tryComputeIncomingUrl } from './urls.ts';

Deno.test({
    name: 'cleanUrl',
    fn: () => {
        const alreadyClean = [
            'https://a.com',
            'http://localhost:8000/path',
        ];
        for (const url of alreadyClean) {
            assertEquals(cleanUrl(url), url);
        }
        const cleaned = {
            'HTTPS://a.com': 'https://a.com',
            '  http://a.com ': 'http://a.com',
            'http://host:80/path': 'http://host/path',
            'http://host/path#a': 'http://host/path',
            'http://host#a': 'http://host',
            'http://MYhost.com': 'http://myhost.com',
            '  httpS://MYhost.com:443/path/#a  ': 'https://myhost.com/path/',
        }
        for (const [ input, expected ] of Object.entries(cleaned)) {
            assertEquals(cleanUrl(input), expected);
        }

        const bad = [
            'ftp://a.com',
            'a.com',
        ];
        for (const input of bad) {
            assertThrows(() => cleanUrl(input));
        }
    }
});


Deno.test({
    name: 'computeMatchUrl',
    fn: () => {
        const good = {
            'HTTPS://a.com': 'a.com',
            'HTTPS://a.com/FOO/': 'a.com/foo',
            'HTTPS://a.com/FOO/#a': 'a.com/foo',
            'https://a.com/foo?a=b&amp;c=d': 'a.com/foo?a=b&c=d',
        }
        for (const [ input, expected ] of Object.entries(good)) {
            assertEquals(computeMatchUrl(input), expected);
        }

        const queryless = {
            'HTTPS://a.com/foo?a=b': 'a.com/foo',
        }
        for (const [ input, expected ] of Object.entries(queryless)) {
            assertEquals(computeMatchUrl(input, { queryless: true }), expected);
        }

        const bad = [
            'ftp://a.com',
            'a.com',
        ];
        for (const input of bad) {
            assertThrows(() => cleanUrl(input));
        }
    }
});

Deno.test({
    name: 'tryComputeIncomingUrl',
    fn: () => {
        const good = {
            'HTTPS://a.com': 'https://a.com/',
            'https://a.com/path/to/file.mp3': 'https://a.com/path/to/file.mp3',
            'https://a.com/a file.mp3': 'https://a.com/a%20file.mp3',
            'https://a.com/ä.mp3': 'https://a.com/%C3%A4.mp3',
        }
        for (const [ input, expected ] of Object.entries(good)) {
            assertEquals(tryComputeIncomingUrl(input), expected);
        }

        const bad = [
            'a.com',
            'a',
            '',
        ];
        for (const input of bad) {
            assertEquals(tryComputeIncomingUrl(input), undefined);
        }
    }
});
