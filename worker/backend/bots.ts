export type BotType = 'bot' | 'bot-lib' | 'unknown-bot' | 'opera-desktop-sans-referrer';

export function computeBotType({ agentType, agentName = '', deviceType, referrerName }: { agentType: string, agentName?: string, deviceType?: string, referrerName?: string }): BotType | undefined {
    if (agentType === 'bot') return 'bot'; // easy
    if (agentType === 'library' && isBotLibrary(agentName)) return 'bot-lib'; // some libraries are used in listener apps for playback
    if (agentType === 'unknown' && /bot/i.test(agentName)) return 'unknown-bot'; // "bot" in the user-agent string for unknown agents

    // 2022-12-12: Observed Opera desktop pre-downloading all enclosures for rss feeds added to "My Sources" - they have no referrer
    if (agentType === 'browser' && agentName === 'Opera' && deviceType === 'computer' && referrerName === undefined) return 'opera-desktop-sans-referrer';
}

//

function isBotLibrary(library: string): boolean {
    // TODO maybe this should be a shared attribute in user-agents-v2?
    return [ 'Go Http Client', 'urllib (python)', 'okhttp', 'ffmpeg', 'Axios (Node)', 'Apache HttpClient', 'Got (node)', 'Dart' ].includes(library);
}
