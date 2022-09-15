import { WorkerEnv } from '../worker_env.ts';

export function computeInfoResponse(env: WorkerEnv): Response {
    const { instance, deployTime, deployRepositoryUrl, deploySha, deployFrom } = env;

    const payload = Object.fromEntries(Object.entries({ instance, deployTime, deployRepositoryUrl, deploySha, deployFrom }).filter(v => v[1] !== ''));

    return new Response(JSON.stringify(payload, undefined, 2), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}
