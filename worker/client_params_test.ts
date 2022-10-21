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
    }
});
