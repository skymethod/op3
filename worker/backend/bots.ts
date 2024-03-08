export type BotType = 'bot' | 'bot-lib' | 'unknown-bot' | 'opera-desktop-sans-referrer' | 'no-ua' | 'podverse-web-preload';

export function computeBotType({ agentType, agentName = '', deviceType, referrerName }: { agentType: string, agentName?: string, deviceType?: string, referrerName?: string }): BotType | undefined {
    if (agentType === 'bot') return 'bot'; // easy
    if (agentType === 'bot-library') return 'bot-lib'; // user-agents-v2 type='library' with category='bot'
    if (agentType === 'unknown' && /(bot|crawler|spider)/i.test(agentName)) return 'unknown-bot'; // "bot", "crawler" or "spider" in the user-agent string for unknown agents
    if (agentName === '') return 'no-ua'; // no user-agent header provided in the request (or blank) - majority found from Amazon IPs

    // 2022-12-12: Observed Opera desktop pre-downloading all enclosures for rss feeds added to "My Sources" - they have no referrer
    if (agentType === 'browser' && agentName === 'Opera' && deviceType === 'computer' && referrerName === undefined) return 'opera-desktop-sans-referrer';

    // 2024-03-08: Observed Podverse embedded player widget and first-party player requesting the entire file before user playback (preload="metadata")
    if (agentType === 'browser' && referrerName === 'Podverse') return 'podverse-web-preload';
}
