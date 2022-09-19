import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { RpcClient } from '../rpc_model.ts';
import { computeQueryRedirectLogsResponse } from './api_query_redirect_logs.ts';

Deno.test({
    name: 'computeQueryRedirectLogsResponse',
    fn: async () => {
        const res = await computeQueryRedirectLogsResponse('GET', new URLSearchParams({ url: 'https://example.com/path/to/ep.mp3*'}), {} as RpcClient);
        assertEquals(res.status, 400);
        assertStringIncludes(await res.text(), 'not implemented yet');
    }
});
