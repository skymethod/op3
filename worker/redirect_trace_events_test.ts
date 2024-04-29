import { generateHmacKeyBytes } from './crypto.ts';
import { CfCacheOptions } from './deps.ts';
import { computeRedirectTraceEvent, packAppleVersion } from './redirect_trace_events.ts';
import { ValidRedirectRequest } from './routes/redirect_episode.ts';
import { RawRedirect } from './rpc_model.ts';
import { increment } from './summaries.ts';
import { assertEquals, assertMatch, assertNotEquals } from './tests/deps.ts';
import { StubCfCache, StubKVNamespace } from './tests/stubs.ts';
import { generateUuid } from './uuid.ts';

Deno.test({
    name: 'packAppleVersion',
    fn: () => {
        const cases: Record<string, number> = {
            '1111.2222.3333.4444': 1111_2222_3333_4444,
            '0001.0000.0000.0001': 1_0000_0000_0001,
        };
        for (const [ input, expected ] of Object.entries(cases)) {
            assertEquals(packAppleVersion(input), expected);
        }
    }
});

Deno.test({
    name: 'computeRedirectTraceEvent',
    fn: async () => {
        const url = 'https://op3.dev/e/example.com/path/to/file.mp3';
        const userAgent = 'Podcasty/1630.11 CFNetwork/1329 Darwin/21.3.0';
        const request = new Request(url, { headers: { 'user-agent': userAgent }});
        const redirectRequest: ValidRedirectRequest = { kind: 'valid', targetUrl: 'https://example.com/path/to/file.mp3' };
        const banned = false;
        const cache = new TestCfCache();
        const kvNamespace = new TestKVNamespace();

        let validRawRedirect: RawRedirect | undefined = undefined;
        let rawIpAddress = '192.168.0.1';
        let event = await computeRedirectTraceEvent({ request, redirectRequest, validRawRedirect, rawIpAddress, banned, cache, kvNamespace });
        // console.log(event);
        assertEquals(event.kind, 'valid-redirect');
        assertEquals(event.destinationHostname, 'example.com');
        assertEquals(event.ipAddressVersion, 4);
        assertEquals(event.ipAddressShape, 'nnn.nnn.n.n');
        assertEquals(event.errors.length, 0);
        assertEquals(event.apVersion, 1630_0011_0000_0000);
        assertEquals(event.botType, undefined);

        const uuid = generateUuid();
        const time = new Date().getTime();
        const month = new Date(time).toISOString().substring(0, 7);
        const cacheKey = `http://op3.com/_kvcache/redirects-hmac-${month}`;
        validRawRedirect = { uuid, time, rawIpAddress, method: 'GET', url, userAgent };
        cache.map.set(cacheKey, undefined);
        const keyHex = (await generateHmacKeyBytes()).hex();
        kvNamespace.map.set(`redirects-hmac-${month}`, keyHex);
        event = await computeRedirectTraceEvent({ request, redirectRequest, validRawRedirect, rawIpAddress, banned, cache, kvNamespace });
        // console.log(event);
        {
            const { hashedIpAddress = '', hashedIpAddressForDownload = '', audienceIdDownloadId = '', audienceIdDownloadId2 = '' } = event;
            assertMatch(hashedIpAddress, /^[0-9a-f]{40}$/);
            assertMatch(hashedIpAddressForDownload, /^[0-9a-f]{40}$/);
            assertEquals(hashedIpAddressForDownload, hashedIpAddress);
            assertMatch(audienceIdDownloadId, /^[0-9a-f]{64}-[0-9a-f]{64}$/);
            assertMatch(audienceIdDownloadId2, /^[0-9a-f]{64}-[0-9a-f]{64}$/);
            assertEquals(audienceIdDownloadId, audienceIdDownloadId2);
        }
        assertEquals(cache.putCounts[cacheKey], 1);

        event = await computeRedirectTraceEvent({ request, redirectRequest, validRawRedirect, rawIpAddress, banned, cache, kvNamespace });
        // console.log(event);
        {
            const { hashedIpAddress = '', hashedIpAddressForDownload = '', audienceIdDownloadId = '', audienceIdDownloadId2 = '' } = event;
            assertMatch(hashedIpAddress, /^[0-9a-f]{40}$/);
            assertMatch(hashedIpAddressForDownload, /^[0-9a-f]{40}$/);
            assertEquals(hashedIpAddressForDownload, hashedIpAddress);
            assertMatch(audienceIdDownloadId, /^[0-9a-f]{64}-[0-9a-f]{64}$/);
            assertMatch(audienceIdDownloadId2, /^[0-9a-f]{64}-[0-9a-f]{64}$/);
            assertEquals(audienceIdDownloadId, audienceIdDownloadId2);
        }
        assertEquals(cache.putCounts[cacheKey], 1);

        rawIpAddress = '2001:db8:3333:4444:5555:6666:7777:8888';
        event = await computeRedirectTraceEvent({ request, redirectRequest, validRawRedirect, rawIpAddress, banned, cache, kvNamespace });
        {
            const { hashedIpAddress = '', hashedIpAddressForDownload = '', audienceIdDownloadId = '', audienceIdDownloadId2 = '' } = event;
            assertNotEquals(hashedIpAddressForDownload, hashedIpAddress);
            assertNotEquals(audienceIdDownloadId, audienceIdDownloadId2);
        }
    }
});

class TestCfCache extends StubCfCache {
    readonly map = new Map<string, Response | undefined>();
    readonly putCounts: Record<string, number> = {};

    async match(request: string | Request, opts?: CfCacheOptions): Promise<Response | undefined> {
        await Promise.resolve();
        if (typeof request === 'string' && opts === undefined) {
            if (this.map.has(request)) return this.map.get(request);
        }
        throw new Error(`TestCfCache: match(${JSON.stringify({ request, opts })}) not implemented`);
    }

    async put(request: string | Request, response: Response): Promise<undefined> {
        await Promise.resolve();
        if (typeof request === 'string') {
            this.map.set(request, response);
            increment(this.putCounts, request);
            return;
        }
        throw new Error(`TestCfCache: put(${JSON.stringify({ request, response })}) not implemented`);
    }
    
}

class TestKVNamespace extends StubKVNamespace {
    readonly map = new Map<string, string | undefined>();
    // deno-lint-ignore no-explicit-any
    async get(key: unknown, opts: unknown): Promise<any> {
        await Promise.resolve();
        if (typeof key === 'string' && opts === undefined) {
            if (this.map.has(key)) return this.map.get(key);
        }
        throw new Error(`TestKVNamespace: get(${JSON.stringify({ key, opts })}) not implemented`);
    }
}
