import { isStringRecord } from '../check.ts';
import { ErrorInterface, isErrorInterface } from '../errors.ts';

export type WorkRecord = (FeedWorkRecord | PodcastGuidWorkRecord) & {
    readonly uuid: string;
    readonly attempt: number;
    readonly notBeforeInstant?: string;
};

export function isWorkRecord(obj: unknown): obj is WorkRecord {
    return isStringRecord(obj)
        && typeof obj.uuid === 'string'
        && typeof obj.attempt === 'number'
        && (obj.notBeforeInstant === undefined || typeof obj.notBeforeInstant === 'string')
        && typeof obj.kind === 'string'
        && ((obj.kind === 'lookup-pg' && typeof obj.podcastGuid === 'string') || typeof obj.feedUrl === 'string')
        ;
}

export interface FeedWorkRecord {
    readonly kind: 'update-feed' | 'lookup-feed' | 'index-items';
    readonly feedUrl: string;
}

export interface PodcastGuidWorkRecord {
    readonly kind: 'lookup-pg';
    readonly podcastGuid: string;
}

export interface FeedRecord {
    readonly id: string; // sha256(url)
    readonly url: string; // clean url
    readonly lastNotModifiedInstant?: string // based on lastOkFetch
    readonly lastOkFetch?: FetchInfo;
    readonly lastErrorFetch?: FetchInfo;
    readonly nextUpdateInstant?: string;
    readonly nextUpdateFeedWorkKey?: string;
    readonly state: 'new' | 'failing' | 'succeeding' | 'disabled';
    readonly piFeed?: PodcastIndexFeed;
    readonly piCheckedInstant?: string;
    readonly nextLookupFeedWorkKey?: string;
    readonly relevantUrls?: Record<string, string>;  // jpath string (image.0.url): <op3 url>
    readonly showUuid?: string;
}

export function isFeedRecord(obj: unknown): obj is FeedRecord {
    return isStringRecord(obj)
        && typeof obj.id === 'string'
        && typeof obj.url === 'string'
        && (obj.lastNotModifiedInstant === undefined || typeof obj.lastNotModifiedInstant === 'string')
        && (obj.lastOkFetch === undefined || isFetchInfo(obj.lastOkFetch))
        && (obj.lastErrorFetch === undefined || isFetchInfo(obj.lastErrorFetch))
        && (obj.nextUpdateInstant === undefined || typeof obj.nextUpdateInstant === 'string')
        && (obj.nextUpdateFeedWorkKey === undefined || typeof obj.nextUpdateFeedWorkKey === 'string')
        && typeof obj.state === 'string'
        && (obj.piFeed === undefined || isPodcastIndexFeed(obj.piFeed))
        && (obj.piCheckedInstant === undefined || typeof obj.piCheckedInstant === 'string')
        && (obj.nextLookupFeedWorkKey === undefined || typeof obj.nextLookupFeedWorkKey === 'string')
        && (obj.relevantUrls === undefined || isStringRecord(obj.relevantUrls) && Object.values(obj.relevantUrls).every(v => typeof v === 'string'))
        && (obj.showUuid === undefined || typeof obj.showUuid === 'string')
        ;
}

export interface FetchInfo {
    readonly requestInstant: string; // instant
    readonly responseInstant: string; // instant
    readonly headers?: string[][];
    readonly body?: string; // r2 pointer
    readonly error?: ErrorInterface;
}

export function isFetchInfo(obj: unknown): obj is FetchInfo {
    return isStringRecord(obj)
        && typeof obj.requestInstant === 'string'
        && typeof obj.responseInstant === 'string'
        && (obj.headers === undefined || Array.isArray(obj.headers) && obj.headers.every(v => Array.isArray(v) && v.every(w => typeof w === 'string')))
        && (obj.body === undefined || typeof obj.body === 'string')
        && (obj.error === undefined || isErrorInterface(obj.error))
        ;
}

export interface PodcastIndexFeed {
    readonly id: number;
    readonly url: string;
    readonly podcastGuid?: string;
}

export function isPodcastIndexFeed(obj: unknown): obj is PodcastIndexFeed {
    return isStringRecord(obj)
        && typeof obj.id === 'number'
        && typeof obj.url === 'string'
        && (obj.podcastGuid === undefined || typeof obj.podcastGuid === 'string')
        ;
}
