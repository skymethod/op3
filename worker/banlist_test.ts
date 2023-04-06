import { assertEquals } from './tests/deps.ts';
import { Banlist } from './banlist.ts';
import { CfCacheOptions } from './deps.ts';
import { StubCfCache, StubKVNamespace } from './tests/stubs.ts';

Deno.test({
    name: 'isBanned',
    fn: async () => {

        const namespace = new StubKVNamespace();
        const cache = new TestCfCache([ 'banned.sus' ]);
        const banlist = new Banlist(namespace, cache);

        const ban = [
            'https://example.localhost',
            'https://example.test',
            'https://example.localhost/a.txt',
            'https://banned.sus/a',
            'https://https',
        ];

        for (const targetUrl of ban) {
            assertEquals(await banlist.isBanned(targetUrl), true, targetUrl);
        }

        const allow = [
            '',
            'https://example.com',
            'https://example.localhost/a.mp3',
            'https://example.localhost/a.mp4',
            'https://notbanned.sus/a',
            'https://https/a.mp3?updated=1677608207',
            'https://https/a.mp3',
            'https://https/a.mp3?',
        ];

        for (const targetUrl of allow) {
            assertEquals(await banlist.isBanned(targetUrl), false, targetUrl);
        }
    }
});

//

class TestCfCache extends StubCfCache {
    private readonly bannedHostnames: string[];

    constructor(bannedHostnames: string[]) {
        super();
        this.bannedHostnames = bannedHostnames;
    }

    async match(request: string | Request, opts?: CfCacheOptions): Promise<Response | undefined> {
        await Promise.resolve();
        if (request === 'http://op3.com/banlist') {
            return new Response(JSON.stringify(this.bannedHostnames));
        }
        return super.match(request, opts);
    }

}
