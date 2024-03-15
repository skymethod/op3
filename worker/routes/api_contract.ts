export const QUERY_REDIRECT_LOGS = {
    limitDefault: 100,
    limitMax: 1000,
    limitMin: 0,
}

export const QUERY_HITS = {
    limitDefault: 100,
    limitMax: 1000,
    limitMin: 0,
}

export const QUERY_DOWNLOADS = {
    limitDefault: 100,
    limitMax: 20000,
    limitMin: 0,
}

export const QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS = {
    limitDefault: 100,
    limitMax: 100,
    limitMin: 1,
}

export const computeApiVersion = (instance: string): string => `0.0.3${instance === 'prod' ? '' : `-${instance}`}`;
