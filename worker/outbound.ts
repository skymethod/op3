import { PodcastIndexClient } from './podcast_index_client.ts';

export function newPodcastIndexClient({ podcastIndexCredentials, origin }: { podcastIndexCredentials: string, origin: string }): PodcastIndexClient | undefined {
    return PodcastIndexClient.of({ podcastIndexCredentials, userAgent: computeUserAgent({ origin }) });
}

export function computeUserAgent({ origin }: { origin: string }): string {
    return `op3-fetcher/1.0 (bot; ${origin})`;
}

export async function tryPostDebug({ debugWebhookUrl, origin, instance, data }: { debugWebhookUrl: string, origin: string, instance: string, data: Record<string, string | undefined> }) {
    try {
        const body = new URLSearchParams();
        body.set('time', new Date().toISOString());
        body.set('instance', instance);
        for (const [ name, value ] of Object.entries(data)) {
            if (value) body.set(name, value);
        }
        await fetch(debugWebhookUrl, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': computeUserAgent({ origin }) } })
    } catch {
        // noop
    }
}
