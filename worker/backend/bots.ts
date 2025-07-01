export type BotType = 'bot' | 'bot-lib' | 'unknown-bot' | 'bot-ip' | 'opera-desktop-sans-referrer' | 'no-ua' | 'podverse-web-preload' | 'web-widget-preload';

export function computeBotType({ agentType, agentName = '', deviceType, referrerName, tags = '', date }: { agentType: string, agentName?: string, deviceType?: string, referrerName?: string, tags?: string, date: string }): BotType | undefined {
    if (agentType === 'bot') return 'bot'; // easy
    if (agentType === 'bot-library') return 'bot-lib'; // user-agents-v2 type='library' with category='bot'
    if (agentType === 'unknown' && /(bot|crawler|spider)/i.test(agentName)) return 'unknown-bot'; // "bot", "crawler" or "spider" in the user-agent string for unknown agents
    if (agentName === '') return 'no-ua'; // no user-agent header provided in the request (or blank) - majority found from Amazon IPs

    // 2022-12-12: Observed Opera desktop pre-downloading all enclosures for rss feeds added to "My Sources" - they have no referrer
    if (agentType === 'browser' && agentName === 'Opera' && deviceType === 'computer' && referrerName === undefined) return 'opera-desktop-sans-referrer';

    // 2024-03-08: Observed Podverse embedded player widget and first-party player requesting the entire file before user playback (preload="metadata")
    if (agentType === 'browser' && referrerName === 'Podverse') return 'podverse-web-preload';

    // 2024-03-11: Observed two other embedded player widgets requesting the entire file before user playback (preload="metadata")
    if (agentType === 'browser' && agentName === 'Podfriend' && tags.includes('web-widget')) return 'web-widget-preload';
    if (agentType === 'browser' && agentName === 'JustCast' && tags.includes('web-widget') && date < '2024-03-19') return 'web-widget-preload'; // 2024-03-19: fixed!

    // 2024-08-21: Found ips with evidence of automated/bot-like requests
    if (tags.includes('bot-ip')) return 'bot-ip';
}

export function isWebWidgetHostname(hostname: string): boolean {
    return knownWebWidgetHostnames.has(hostname);
}

export function isBotIpHash({ hashedIpAddress, destinationServerUrl, asn, agentName, deviceName, regionCode }: { hashedIpAddress: string, destinationServerUrl: string, asn: string, agentName: string | undefined, deviceName: string | undefined, regionCode: string }): boolean {
    return botIpHashes.has(hashedIpAddress)
        || asn === '16591' && regionCode === 'TX' && agentName === 'Chrome' && deviceName === 'Windows Computer' && destinationServerUrl.includes('/ondemand.kut.org/') && destinationServerUrl.includes('kut-news-now');
}

//

const knownWebWidgetHostnames = new Set([
    'widget.podfriend.com',
    'widget.justcast.com',
]);

const botIpHashes = new Set([
    'c1cf85ed0bcb71afdc52ce52ad54cba30cf05a7e', // 2024-08-21 for 2024-08-19
    '055339109b8a6d1c0f508fb491fec8ca54526748', // 2024-08-21 for 2024-08-19
    '9d966be7e654e5404f0588652bfab78b58dfe3d4', // 2024-08-26 for 2024-08-25
    '30f72fe4ce0f92c2f65d67e8a77b46b28f7375f2', // 2024-09-11 for 2024-09-10
    '1643d6496a29bf30bf64abd49727e9b226fd4873', // 2024-09-12 for 2024-09-10to11
    '545c649ac9160b19bf7440382827caa7a2601da4', // 2024-09-14 for 2024-09-13
    'ea995be261fb3b6002cfd7c2cb8c9e1dc9dab520', // 2024-09-15 for 2024-09-14
    '33e55a2603cb15dd5bc8933134cbab31ff032808', // 2024-09-17 for 2024-09-16
    '73aef72c3f695b4583864abf7658dcc5970cf4d0', // 2024-09-17 for 2024-09-16
    '4323cdce763b110a7e9b09a7382b52457e1a1046', // 2024-10-02 for 2024-10-01
    '550ff36a29f8804f6f30692e55be72fe2f1ff24d', // 2024-10-02 for 2024-10-01
    'd16988e99c9444b0c1259414f15b6b750088a690', // 2024-10-02 for 2024-10-01
    'e14766cc89e6645cac8cb050ae8adfb547d8054e', // 2024-10-02 for 2024-10-01
    '1cdc9f8767f033808dd263e6df65ce18b6ecad94', // 2024-10-03 for 2024-10-02
    '516440b90ae705a7cdf3e2fcee430f89e5ab5251', // 2024-10-06 for 2024-10-05
    '2ab919bc715bd9982e07f0ea2a3b855847470dc0', // 2024-10-25 for 2024-10-24
    'c7fddc49f137f524f231bb5843fc227750839d34', // 2024-10-28 for 2024-10-26to27
    '10e1df51c6209d866006f706e88e97f4ced49517', // 2024-11-07 for 2024-11-05to06
    '436cda5cb7f9d0af522ee0537666bca1995cd242', // 2024-11-17 for 2024-11-14to16
    '69f31bd6f01cda7039eb8296ffacccf6c5f36591', // 2024-11-17 for 2024-11-14to16
    '845a8c7592953d9be57a8bb62db8aa083b85e329', // 2024-11-17 for 2024-11-14to16
    'dba29deb0809737e2f0ed34e603ac24dd0c73422', // 2024-11-17 for 2024-11-14to16
    'ee4e164b4ab2273dfa7f4ab3567879cf31c1c687', // 2024-11-17 for 2024-11-14to16
    'ef15dd9fce83d94c6bd2732610690be35fe74045', // 2024-11-17 for 2024-11-14to16
    'f7018c4219b6789b69106d216bba0d59fb1b8183', // 2024-11-17 for 2024-11-14to16
    '828e9645e4c49afea1c4a2a7e275c25f605d9d11', // 2024-12-05 for 2024-12-04
    '03c97f1f3af500762e85c4e0f9bffb11761f92bc', // 2025-02-10 for 2025-02-09
    '3fdb18a6d0fcc76289fe583b5ed7e0ce08c0f29a', // 2025-02-18 for 2025-02-17
    '7a161434362a72de547e647e2fa18e8b20215bf2',
    '1068c6c67d930e32b1cc7b1fbe003b042e157c97',
    'f3ecf1a0c1eb5c5dec292496b7a92dc23c42e653',
    '168bbd7dcea6742ab2c4daf7962a2b3b64bb4f18',
    'ae2121fda7ca5aee0949243fc5440c3dc0496f2f',
    '5e2a10c2cebe01d1d86a47bbf2dd719f6bf60c17',
    '0e55b387431541ce4c3404ad30aaedb1490937c6',
    '168e43b87c94fe15dc5da293ab8f4a838ed2c8de',
    'a1e7b9efe2bc09c0db4598ce579eb96bd30c9d99',
    'bc1400d11e1258fdcdfb53119c77a24151ca5735',
    '32f5ccf16fc6fd88dc790e3c59c202edf45129bc',
    '5a8ce5c15b702fb94c8684d273ffb51d3c0383c4',
    '44a1ffa89090b97a0078e017abc5b8d6a32fa745',
    '98af81e2e365569258f917870de7441a3c77c16d', // 2025-03-06 for 2025-02-20+
    'b50557114b28ff0a5305e9c9964d1bba7f4bfaf7', // 2025-03-07 for 2025-03-06
    '3cbce14d54b3eadad8b7ac748a0b66d04fb3d11c', // 2025-03-08 for 2025-03-07
    'ccbc06f31bfbb2de31fc13af2cca028ef76d3c4c', // 2025-03-09 for 2025-03-08
    '71f934c1654432344b1258ba7736edf87926cebb', // 2025-03-10 for 2025-03-09
    '6e14e49bfe04ce3552c480edfc94b3c4c37d082e', // 2025-03-13 for 2025-03-10
    '7d87debb8d1d457e91072434663cdfe12e8b76ca', // 2025-03-13 for 2025-03-10
    '6e14e49bfe04ce3552c480edfc94b3c4c37d082e', // 2025-03-13 for 2025-03-11
    'c55b7a990c6d86845c8401eee4fd25ec2136349b', // 2025-03-13 for 2025-03-11
    'c55b7a990c6d86845c8401eee4fd25ec2136349b', // 2025-03-13 for 2025-03-12
    'f3664a0dd9517dff6fbc1f7bf4b63318e2d6cac6', // 2025-03-13 for 2025-03-12
    '5e222642efa7475c2f1139df52964394be7529a2', // 2025-03-14 for 2025-03-13
    '9e5fec25f8e53897e76d58e7ad8643d46945c459', // 2025-05-15 for 2025-05-14
    '80291a84a72bbc46b16ff7e5586502377d6cf317', // 2025-05-21 for 2025-05-20
    '0f47ab0445eec3790582b0e177a1d1df54fdab6c', // 2025-05-23 for 2025-05-22
    '99792e9e816e254a08937772ce05e7189af2b08c', // 2025-05-26 for 2025-05-25
    'ad55ddeb7a42cad5cdad81cd32daec6dd0f18aae', // 2025-05-27 for 2025-05-26
    '15129f5517cd0f31bb081f17e0d43642498b4c37', // 2025-05-28 for 2025-05-27
    '2d0d74ba3d7f0f1b39b3258d96fff8b3d16cbd95', // 2025-05-28 for 2025-05-27
    'af63da28cf4ec66e95d08103aa8798362bce7eda', // 2025-05-28 for 2025-05-27
    'ed68f47ead6c584a24f229a405d6ca3c8d525530', // 2025-05-28 for 2025-05-27
    'ebf53675645d4053b8907f46ec263e553542eb95', // 2025-06-12 for 2025-06-11
    '94aeb210f990d09fe131a5b1635a5c4b08564a8a', // 2025-06-17 for 2025-06-16
    '2b213566e3a31109ae95e26e45e8ae083fc2b9f4', // 2025-06-29 for 2025-06-28
    'a4a5e364bf6257010a86f127541d4a2ea44fde3d', // 2025-06-29 for 2025-06-28
    'd4d12c537530247929e2f8c879d4be294f7c3851', // 2025-07-01 for 2025-06-30
]);
