import { PodcastIndexClient } from './podcast_index_client.ts';

export function newPodcastIndexClient({ podcastIndexCredentials, origin }: { podcastIndexCredentials: string, origin: string }): PodcastIndexClient | undefined {
    return PodcastIndexClient.of({ podcastIndexCredentials, userAgent: computeUserAgent({ origin }) });
}

export function computeUserAgent({ origin }: { origin: string }): string {
    return `op3-fetcher/1.0 (bot; ${origin})`;
}
