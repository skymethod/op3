import { computeChainDestinationHostname } from './chain_estimate.ts';
import { tryParseJson } from './check.ts';
import { KVNamespace, CfCache } from './deps.ts';
import { consoleWarn } from './tracer.ts';

export class Banlist {
    private readonly namespace?: KVNamespace;
    private readonly cache?: CfCache;

    private bannedHostnames: Set<string> | undefined;

    constructor(namespace: KVNamespace | undefined, cache: CfCache | undefined) {
        this.namespace = namespace;
        this.cache = cache;
    }

    async isBanned(targetUrl: string): Promise<boolean> {
        // must never throw!
        if (targetUrl.includes('js/netsoltrademark.php')) return true; // ban /e/http://bad.domain/__media__/js/netsoltrademark.php?d=anotherbad.domain%2Fpath%2F
        if (targetUrl.includes('/bitrix/redirect.php?')) return true; // ban /e/https://bad.domain/bitrix/redirect.php?goto=https%3A%2F%2Fanotherbad.domain%2F

        const { namespace, cache } = this;
        if (!namespace) return false;

        try {
            if (/\.(mp3|mp4)(\?.*)?$/i.test(targetUrl)) return false;
            const targetHostname = computeChainDestinationHostname(targetUrl, { urlDecodeIfNecessary: true }); // evil urls will try to urlencode / to %2F
            if (targetHostname === undefined) return false;
            if (isReservedForTesting(targetHostname)) return true;
            if (!targetHostname.includes('.')) return true; // ban /e/whatever/path/to/file.mp3
            if (!this.bannedHostnames) this.bannedHostnames = await loadBannedHostnames(namespace, cache);
            return this.bannedHostnames.has(targetHostname);
        } catch (e) {
            consoleWarn('banlist', `Unexpected error inside banlist.isBanned(${targetUrl}): ${e.stack || e}`);
            return false;
        }
    }

}

//

function isReservedForTesting(hostname: string): boolean {
    // https://www.rfc-editor.org/rfc/rfc2606.html#section-2
    return /^(.+?\.)?(test|example|invalid|localhost)$/.test(hostname);
}

async function loadBannedHostnames(namespace: KVNamespace, cache: CfCache | undefined): Promise<Set<string>> {
    const cacheKey = 'http://op3.com/banlist'; // must be a valid hostname, but never routable to avoid conflicts with worker fetch
    if (cache) {
        const res = await cache.match(cacheKey);
        if (res) {
            const arr = await res.json();
            return readBannedHostnames(arr, 'cache');
        }
    }
    const str = await namespace.get('banlist', { type: 'text' });
    const arr = tryParseJson(str ?? '[]');
    const rt = readBannedHostnames(arr, 'kv');
    if (cache) {
        const body = JSON.stringify([...rt]);
        await cache.put(cacheKey, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': `s-maxage=${10 * 60}` } })); // cache for 10 minutes
    }
    return rt;
}

function readBannedHostnames(arr: unknown, source: string): Set<string> {
    if (!(Array.isArray(arr) && arr.every(v => typeof v === 'string' && v.length > 0))) throw new Error(`Invalid banlist: ${JSON.stringify(arr)}`);
    const rt = new Set(arr);
    console.log(`banlist: read ${rt.size} banned hostnames from ${source}`);
    return rt;
}
