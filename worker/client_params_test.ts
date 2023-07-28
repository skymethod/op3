import { assertEquals } from './tests/deps.ts';
import { tryParseClientParams, tryParseUlid, computeServerUrl } from './client_params.ts';

Deno.test({
    name: 'tryParseUrl',
    fn: () => {
        assertEquals(tryParseUlid('https://a.com/foo?_ulid=asdf'), 'asdf');
        assertEquals(tryParseUlid('https://a.com/foo?a=b&_ulid=asdf2'), 'asdf2');
        assertEquals(tryParseUlid('https://a.com/foo?_ulid=asdf3&a=b'), 'asdf3');
        assertEquals(tryParseUlid('https://a.com/foo?a=b&_ulid=asdf4&c=d'), 'asdf4');
        assertEquals(tryParseUlid('https://a.com/foo?_ulid='), undefined);

        assertEquals(tryParseUlid('https://a.com/foo?ulid=asdf'), undefined);
    }
});

Deno.test({
    name: 'tryParseClientParams',
    fn: () => {
        assertEquals(tryParseClientParams('https://a.com/foo?_ulid=asdf'), { serverUrl: 'https://a.com/foo', clientParams: { '_ulid': 'asdf' }});
        assertEquals(tryParseClientParams('https://a.com/foo?_ulid='), { serverUrl: 'https://a.com/foo', clientParams: { '_ulid': '' }});
        assertEquals(tryParseClientParams('https://a.com/foo?a&_ulid='), { serverUrl: 'https://a.com/foo?a', clientParams: { '_ulid': '' }});
        assertEquals(tryParseClientParams('https://a.com/foo?a=b&_ulid=asdf'), { serverUrl: 'https://a.com/foo?a=b', clientParams: { '_ulid': 'asdf' }});
        assertEquals(tryParseClientParams('https://a.com/foo?_from=a.b.c&a=b&_ulid=asdf'), { serverUrl: 'https://a.com/foo?a=b', clientParams: { '_ulid': 'asdf', '_from': 'a.b.c' }});
        assertEquals(tryParseClientParams('https://a.com/foo?DIST=TuneIn&TGT=TuneIn&a=b&maxServers=2'), { serverUrl: 'https://a.com/foo?a=b', clientParams: { 'DIST': 'TuneIn', 'TGT': 'TuneIn', 'maxServers': '2' }});
        assertEquals(tryParseClientParams('https://a.com/foo?played_on=player'), { serverUrl: 'https://a.com/foo', clientParams: { 'played_on': 'player' }});
        assertEquals(tryParseClientParams('https://a.com/foo?source=player'), { serverUrl: 'https://a.com/foo', clientParams: { 'source': 'player' }});
        assertEquals(tryParseClientParams('https://a.com/foo?client_source=player_site&referrer=https%3A%2F%2Fpodcast'), { serverUrl: 'https://a.com/foo', clientParams: { 'client_source': 'player_site', 'referrer': 'https://podcast' }});
        assertEquals(tryParseClientParams('https://a.com/foo?acid=&av=2209.1'), { serverUrl: 'https://a.com/foo', clientParams: { 'acid': '', 'av': '2209.1' }});
        assertEquals(tryParseClientParams('https://op3.dev/e,pg=00000000-0000-0000-0000-000000000000/a.com/foo.m4a%3F_from=com.player'), { serverUrl: 'https://op3.dev/e,pg=00000000-0000-0000-0000-000000000000/a.com/foo.m4a', clientParams: { '_from': 'com.player' }});
        assertEquals(tryParseClientParams('https://a.com/?'), { serverUrl: 'https://a.com/', clientParams: { }});
        assertEquals(tryParseClientParams('https://a.com/?a'), { serverUrl: 'https://a.com/?a', clientParams: { }});
        assertEquals(tryParseClientParams('https://a.com?'), { serverUrl: 'https://a.com', clientParams: { }});
        const none = [
            'https://a.com',
            'https://a.com/path/to/episode.mp3',
        ];
        for (const input of none) {
            assertEquals(tryParseClientParams(input), undefined);
        }
    }
});

Deno.test({
    name: 'computeServerUrl',
    fn: () => {
        assertEquals(computeServerUrl('https://a.com/foo?'), 'https://a.com/foo');
        assertEquals(computeServerUrl('https://a.com/foo?='), 'https://a.com/foo');
        assertEquals(computeServerUrl('https://a.com/foo?query='), 'https://a.com/foo');
        assertEquals(computeServerUrl('https://a.com/foo,pg=ebeccf3f-bac0-47e1-ab29-650709e91708/episode.mp3?='), 'https://a.com/foo,pg=ebeccf3f-bac0-47e1-ab29-650709e91708/episode.mp3');
        assertEquals(computeServerUrl('https://a.com:443/foo'), 'https://a.com/foo');
        assertEquals(computeServerUrl('http://sub.a.com:80/foo?a=b'), 'http://sub.a.com/foo?a=b');
        assertEquals(computeServerUrl('http://a.com/foo?fbclid=trackinu'), 'http://a.com/foo');
        assertEquals(computeServerUrl('https://a.com/foo.mp3/;?DIST=TuneIn&TGT=TuneIn&maxServers=2'), 'https://a.com/foo.mp3');
        assertEquals(computeServerUrl('https://a.com/foo.mp3?rss_browser=BAhJIhZBcGFjaGUtSHR0cENsaWVudAY6BkVU--b34738c6ef24353e5e30f8efce0706d4f88110dc'), 'https://a.com/foo.mp3');
    }
});
