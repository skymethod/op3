import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { computeOther, computeRawIpAddress } from './cloudflare_request.ts';

Deno.test({
    name: 'computeRawIpAddress',
    fn: () => {
        const cfConnectingIps = {
            '1.1.1.1': '1.1.1.1',
            '1.1.1.1 ': '1.1.1.1',
            '2.2.2.2 , 3.3.3.3 ': '2.2.2.2',
            ', 3.3.3.3, 4.4.4.4 ': '3.3.3.3',
            '': undefined,
        }
        for (const [ cfConnectingIp, expected ] of Object.entries(cfConnectingIps)) {
            assertEquals(computeRawIpAddress(new Request('http://example.com', { headers: { 'cf-connecting-ip': cfConnectingIp } })), expected);
        }

        assertEquals(computeRawIpAddress(new Request('http://example.com', { headers: { 'asdf': '1.1.1.1' } })), undefined);
    }
});

Deno.test({
    name: 'computeOther',
    fn: () => {
        // deno-lint-ignore no-explicit-any
        const req: any = new Request('http://example.com', { });
        assertEquals(computeOther(req), undefined);
        req.cf = 'asdf';
        assertEquals(computeOther(req), undefined);
        req.cf = {};
        assertEquals(computeOther(req), undefined);
        req.cf.colo = 123;
        assertEquals(computeOther(req), undefined);
        req.cf.colo = '';
        assertEquals(computeOther(req), undefined);
        req.cf.colo = 'DNO';
        assertEquals(computeOther(req), { colo: 'DNO' });
    }
});
