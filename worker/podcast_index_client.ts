import { isStringRecord } from './check.ts';
import { Bytes } from './deps.ts';
import { StatusError } from './errors.ts';

export class PodcastIndexClient {
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly userAgent: string;
    
    constructor({ apiKey, apiSecret, userAgent }: { apiKey: string, apiSecret: string, userAgent: string }) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.userAgent = userAgent;
    }

    static of(opts: { userAgent: string, podcastIndexCredentials: string | undefined }): PodcastIndexClient | undefined {
        const { userAgent, podcastIndexCredentials } = opts;
        const m = /^(\w+):(\w+)$/.exec(podcastIndexCredentials ?? '');
        if (m) {
            const [ _, apiKey, apiSecret ] = m;
            return new PodcastIndexClient({ apiKey, apiSecret, userAgent });
        }
    }

    async searchPodcastsByTerm(q: string): Promise<SearchPodcastsByTermResponse> {
        const u = new URL('https://api.podcastindex.org/api/1.0/search/byterm');
        u.searchParams.set('q', q);
        return await this.makeApiCall(u, checkSearchPodcastsByTermResponse);
    }

    async getPodcastByFeedId(id: number): Promise<GetPodcastResponse> {
        const u = new URL('https://api.podcastindex.org/api/1.0/podcasts/byfeedid');
        u.searchParams.set('id', id.toString());
        return await this.makeApiCall(u, checkGetPodcastResponse);
    }

    async getPodcastByGuid(guid: string): Promise<GetPodcastResponse> {
        const u = new URL('https://api.podcastindex.org/api/1.0/podcasts/byguid');
        u.searchParams.set('guid', guid);
        return await this.makeApiCall(u, checkGetPodcastResponse);
    }

    async getPodcastByFeedUrl(url: string): Promise<GetPodcastResponse> {
        const u = new URL('https://api.podcastindex.org/api/1.0/podcasts/byfeedurl');
        u.searchParams.set('url', url);
        return await this.makeApiCall(u, checkGetPodcastResponse);
    }

    //

    private async makeApiCall<T>(url: URL, responseCheck: (obj: unknown) => obj is T): Promise<T> {
        const time = Math.round(Date.now() / 1000);
        const authorization = (await Bytes.ofUtf8(`${this.apiKey}${this.apiSecret}${time}`).sha1()).hex();
        const res = await fetch(url.toString(), { headers: { 'user-agent': this.userAgent, 'x-auth-key': this.apiKey, 'x-auth-date': time.toString(), authorization } });
        if (res.status !== 200) {
            throw new StatusError(await res.text(), res.status);
        }
        const rt = await res.json();
        // console.log(JSON.stringify(rt, undefined, 2));
        if (!responseCheck(rt)) throw new StatusError(`Unexpected response: ${JSON.stringify(rt)}`);
        return rt;
    }

}

//

export interface GetPodcastResponse {
    readonly status: string; // "true"
    readonly feed: Feed | [];
}

function checkGetPodcastResponse(obj: unknown): obj is GetPodcastResponse {
    if (!isStringRecord(obj)) throw new StatusError(`Unexpected GetPodcastResponse obj: ${JSON.stringify(obj)}`);
    const { status, feed } = obj;
    if (status !== 'true') throw new StatusError(`Unexpected status: ${JSON.stringify(status)}`);
    if (Array.isArray(feed)) {
        if (feed.length !== 0) throw new StatusError(`Unexpected feed array: ${JSON.stringify(feed)}`);
    } else {
        checkFeed(feed);
    }
    return true;
}

export interface SearchPodcastsByTermResponse {
    readonly status: string; // "true"
    readonly feeds: readonly Feed[];
    readonly count: number;
}

function checkSearchPodcastsByTermResponse(obj: unknown): obj is SearchPodcastsByTermResponse {
    if (!isStringRecord(obj)) throw new StatusError(`Unexpected SearchPodcastsByTermResponse obj: ${JSON.stringify(obj)}`);
    const { status, feeds, count } = obj;
    if (status !== 'true') throw new StatusError(`Unexpected status: ${JSON.stringify(status)}`);
    if (typeof count !== 'number') throw new StatusError(`Unexpected count: ${JSON.stringify(count)}`);
    if (!Array.isArray(feeds)) throw new StatusError(`Unexpected feeds: ${JSON.stringify(feeds)}`);
    if (feeds.length !== count) throw new StatusError(`Unexpected feeds.length: ${feeds.length}, expected ${count}`);
    for (const feed of feeds) {
        checkFeed(feed);
    }
    return true;
}

export interface Feed {
    readonly id: number;
    readonly title: string;
    readonly author: string;
    readonly ownerName: string;
    readonly url: string; // feed url
    readonly originalUrl: string; // feed url
    readonly image: string; // url ("The channel-level image element")
    readonly artwork: string; // url ("The seemingly best artwork we can find for the feed. Might be the same as image in most instances")
}

function checkFeed(obj: unknown): obj is Feed {
    if (!isStringRecord(obj)) throw new StatusError(`Unexpected Feed obj: ${JSON.stringify(obj)}`);
    const { id, title, author, ownerName, url, originalUrl, image, artwork } = obj;
    if (typeof id !== 'number') throw new StatusError(`Unexpected id: ${JSON.stringify(id)}`);
    if (typeof title !== 'string') throw new StatusError(`Unexpected title: ${JSON.stringify(title)}`);
    if (typeof author !== 'string') throw new StatusError(`Unexpected author: ${JSON.stringify(author)}`);
    if (typeof ownerName !== 'string') throw new StatusError(`Unexpected ownerName: ${JSON.stringify(ownerName)}`);
    if (typeof url !== 'string') throw new StatusError(`Unexpected url: ${JSON.stringify(url)}`);
    if (typeof originalUrl !== 'string') throw new StatusError(`Unexpected originalUrl: ${JSON.stringify(originalUrl)}`);
    if (typeof image !== 'string') throw new StatusError(`Unexpected image: ${JSON.stringify(image)}`);
    if (typeof artwork !== 'string') throw new StatusError(`Unexpected artwork: ${JSON.stringify(artwork)}`);
    return true;
}
