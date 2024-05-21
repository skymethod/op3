import { assertEquals } from '../tests/deps.ts';
import { computeNamespaceSuffix } from './api.ts';

Deno.test({
    name: 'computeNamespaceSuffix',
    fn: () => {
        const tests: Record<string, string> = {
            '': '',
            '/': '',
            '//': '-e',
            '/foo/': '-foo',
            '/api/1/shows/xywFBKkmEpfwXt5amoU9': '-api-1-shows-x',
            '/admin/rebuild-index': '-admin-rebuild-index',
            '/admin/rebuild-index/': '-admin-rebuild-index',
        };
        for (const [ input, output ] of Object.entries(tests)) {
            assertEquals(computeNamespaceSuffix(input), output);
        }
    }
});
