import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { QueryRedirectLogsRequest, Unkinded } from '../rpc_model.ts';
import { computeQueryRedirectLogsResponse } from './api_query_redirect_logs.ts';

Deno.test({
    name: 'computeQueryRedirectLogsResponse',
    fn: async () => {
        const queryRedirectLogs = (request: Unkinded<QueryRedirectLogsRequest>, target: string) => {
            if (request.urlStartsWith === 'https://example.com/path/to/ep.mp3' && target === 'combined-redirect-log') {
                return new Response('ok!');
            }
            console.log(request, target);
            throw new Error();
        }
        // deno-lint-ignore no-explicit-any
        const res = await computeQueryRedirectLogsResponse('GET', new URLSearchParams({ url: 'https://example.com/path/to/ep.mp3*'}), { queryRedirectLogs } as any);
        assertEquals(res.status, 200);
    }
});
