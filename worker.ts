import { ModuleWorkerContext } from './deps.ts';
import { computeHomeResponse } from './home.ts';
import { computeInfoResponse } from "./info.ts";
import { computeRedirectResponse, tryParseRedirectRequest } from './redirect_episode.ts';
import { WorkerEnv } from './worker_env.ts';

export default {

    fetch(request: Request, env: WorkerEnv, context: ModuleWorkerContext): Response {

        // first, handle redirects - the most important function
        // be careful here: must never throw
        const redirectRequest = tryParseRedirectRequest(request.url);
        if (redirectRequest) {
            context.waitUntil((async () => {
                console.log(`TODO: log request!`);
                await Promise.resolve();
            })());
            return computeRedirectResponse(redirectRequest);
        }

        try {
            const { instance } = env;
            const { method } = request;
            const { pathname } = new URL(request.url);

            if (method === 'GET' && pathname === '/') return computeHomeResponse({ instance });
            if (method === 'GET' && pathname === '/info.json') return computeInfoResponse(env);

            return new Response('not found', { status: 404 });
        } catch (e) {
            console.error(`Unhandled error computing response: ${e.stack || e}`);
            return new Response('failed', { status: 500 });
        }
    }
    
}
