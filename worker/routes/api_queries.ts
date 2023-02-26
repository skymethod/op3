import { Blobs } from '../backend/blobs.ts';
import { tryParseInt } from '../check.ts';
import { packError } from '../errors.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { consoleWarn } from '../tracer.ts';
import { QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS } from './api_contract.ts';
import { isValidRecentEpisodes } from './api_queries_model.ts';

type Opts = { name: string, method: string, searchParams: URLSearchParams, miscBlobs?: Blobs, roMiscBlobs?: Blobs };

export async function computeQueriesResponse({ name, method, searchParams, miscBlobs, roMiscBlobs }: Opts): Promise<Response> {
    if (method !== 'GET') return newMethodNotAllowedResponse(method);

    if (name === 'recent-episodes-with-transcripts') {
        const targetMiscBlobs = searchParams.has('ro') ? roMiscBlobs : miscBlobs;
        if (!targetMiscBlobs) throw new Error(`Need miscBlobs`);
        const { limit: limitParam } = Object.fromEntries(searchParams);
        let limit: number | undefined = QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitDefault;
        if (typeof limitParam === 'string') {
            try {
                limit = tryParseInt(limitParam);
                if (!(typeof limit === 'number' && limit >= QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMin && limit <= QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMax)) throw new Error(`Bad limit: ${limitParam}, must be an integer between ${QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMin} and ${QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMax}`);
            } catch (e) {
                const { message } = packError(e);
                return newJsonResponse({ message }, 400);
            }
        }
        const res = await targetMiscBlobs.get('recent-episodes-with-transcripts.v1.json', 'json');
        if (!isValidRecentEpisodes(res)) {
            consoleWarn('api-queries', `Invalid recent episodes: ${JSON.stringify(res)}`)
        } else {
            let rt = res;
            if (typeof limit === 'number') rt = { ...res, episodes: res.episodes.slice(0, limit) };
            return newJsonResponse(rt);
        }
    }

    return newJsonResponse({ error: 'not found' }, 404);
}
