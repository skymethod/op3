import { MAX_BLOBS_SIZE, computeAnalyticsEngineEvent, computeBlobsSize } from './cloudflare_tracer.ts';
import { assert, assertEquals } from './tests/deps.ts';
import { generateUuid } from './uuid.ts';

Deno.test({
    name: 'computeBlobsSize',
    fn: () => {
        assertEquals(computeBlobsSize(undefined), 0);
        assertEquals(computeBlobsSize([]), 0);
        assertEquals(computeBlobsSize([ '' ]), 0);
        assertEquals(computeBlobsSize([ 'asdf' ]), 4);
        assertEquals(computeBlobsSize([ '😀' ]), 4);
        assertEquals(computeBlobsSize([ new ArrayBuffer(8) ]), 8);
        assertEquals(computeBlobsSize([ 'asdf', 'asdf', 'asdf' ]), 12);
        assertEquals(computeBlobsSize([ null, null ]), 0);
    }
});

Deno.test({
    name: 'computeAnalyticsEngineEvent',
    fn: () => {
        type Input = { tag: string, userAgent: string, url: string, referer: string };
        const inputs: Input[] = [
            { tag: 'base', userAgent: 'Podcasty/1630.11 CFNetwork/1329 Darwin/21.3.0', url: 'https://op3.dev/e/example.com/path/to/file.mp3', referer: '<missing>' },
            { tag: 'longurl', userAgent: 'Podcasty/1630.11 CFNetwork/1329 Darwin/21.3.0', url: `https://op3.dev/e/example.com/path/to/file.mp3?${'x'.repeat(6000)}`, referer: '<missing>' },
            { tag: 'longua-longurl', userAgent: `Podcasty/1630.11 CFNetwork/1329 Darwin/21.3.0${'x'.repeat(6000)}`, url: `https://op3.dev/e/example.com/path/to/file.mp3?${'x'.repeat(6000)}`, referer: '<missing>' },
            { tag: 'longua-longurl-longref', userAgent: `Podcasty/1630.11 CFNetwork/1329 Darwin/21.3.0${'x'.repeat(6000)}`, url: `https://op3.dev/e/example.com/path/to/file.mp3?${'x'.repeat(6000)}`, referer: 'x'.repeat(6000) },
        ];
        const hashedIpAddress = 'a'.repeat(40);
        const audienceIdDownloadId = 'b'.repeat(64);
        for (const { tag, userAgent, url, referer } of inputs) {
            const event = computeAnalyticsEngineEvent({ 
                kind: 'valid-redirect', 
                colo: 'XXX', 
                url,
                country: 'US', 
                destinationHostname: 'example.com', 
                userAgent, 
                referer, 
                hasForwarded: false, 
                hasXForwardedFor: false,
                ipAddressShape: 'n.n.n.n',
                ipAddressVersion: 4,
                errors: [],
                asn: 123,
                apVersion: 1111222233334444,
                cfVersion: 1111222233334444,
                dwVersion: 1111222233334444,
                timeUuid: `${new Date().toISOString()}-${generateUuid()}`,
                botType: 'bot-library',
                hashedIpAddress,
                hashedIpAddressForDownload: hashedIpAddress,
                audienceIdDownloadId,
                audienceIdDownloadId2: audienceIdDownloadId,
                agentTypeAgentName: `type-${userAgent}`,
                deviceTypeDeviceName: `type-name`,
                referrerTypeReferrerName: `type-${referer}`,
                regionCodeRegionName: `type-name`,
                timezone: `America/Argentina/Buenos_Aires`,
                metroCode: `999`,
            });
            // console.log(event);
            const size = computeBlobsSize(event.blobs);
            // console.log({ size });
            assert(size > 0 && size <= MAX_BLOBS_SIZE, `${tag} is ${size}`);
        }
    }
});
