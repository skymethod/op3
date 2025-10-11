export type BotType = 'bot' | 'bot-lib' | 'unknown-bot' | 'bot-ip' | 'opera-desktop-sans-referrer' | 'no-ua' | 'podverse-web-preload' | 'web-widget-preload' | 'crosszone';

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

    // 2025-08-09: Unknown crosszone requests - subrequests from other cf workers use the hardcoded crosszone ip (not the listener ip)
    if (tags.includes('unknown-crosszone')) return 'crosszone';
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
    'e8742b5f3895533ef81a3d4399f032ed322bc31d', // 2025-07-04 for 2025-07-03
    '55a71a603b17cc1acced808321d4537b55485676', // 2025-07-13 for 2025-07-12
    'b677a7d648dddb4fbfc57913e0b8e3f1db569022', // 2025-07-13 for 2025-07-12
    '4a17378f128e28df2ab2cbffbb719eed106b054e', // 2025-07-16 for 2025-07-15
    '6f4a2f2984b109bdb0d67c362de0f046242cd269', // 2025-07-30 for 2025-07-29
    '3080af9c759ddf8482b9427f18f4a12e2f7f3ce4', // 2025-08-01 for 2025-07-31
    '1acee9cfd3c20970fbd5f1d644a5238049fe82f6', // 2025-08-05 for 2025-08-04
    'd93736faf20dd53ce89d6e2ffd567cbd285ab730', // 2025-08-05 for 2025-08-04
    'ee7bfc14e5ebadfcac0ab403d4e2061aab2f53c1', // 2025-08-09 for 2025-08-08
    'db2a64e741d755d040a5589571448dbdf000a6e7', // 2025-08-17 for 2025-08-15to16
    'b324e9082b0a90825742311d6c26719ffacce6ce', // 2025-08-26 for 2025-08-25
    '5caf1acac6e8864bdf76643a0bc63890e1467aa6', // 2025-08-29 for 2025-08-28
    'e951674e33c8c92b66100365be8415334a5d0ba2', // 2025-08-30 for 2025-08-29
    'd350700c457b47300a29484e6110647d1f4f1a8d', // 2025-09-03 for 2025-09-02
    '7fc2791c0cec15088a6c3aae46aa5431a1b06027', // 2025-09-04 for 2025-09-03
    '5d3ef0e09bf3a5b4131cb14caffd4f2c44676cc3', // 2025-09-06 for 2025-09-04to05
    '961258d488724eec7ffb340df316a215ce823f6f', // 2025-09-10 for 2025-09-09
    'fbe5f665ffd5b553d82d9bf130c64e9eece5f607', // 2025-09-10 for 2025-09-09
    '1949ac53bd2459e759800657072b7bfc537d03e7', // 2025-09-15 for 2025-09-14
    '31401cc0a9f67b5c374c5b9b82bc1e327e21ab19', // 2025-09-15 for 2025-09-14
    '566ce0753bfac39cbcb2d38c8ecfd06976ac7197', // 2025-09-15 for 2025-09-14
    'de7ae424171d167635d5e945f92f714448bca052', // 2025-09-15 for 2025-09-14
    '32a61502e041cecf695ec8efddc273c5177be5e2', // 2025-09-16 for 2025-09-14
    '28148fb712152513102076f3a2591d120d90a45d', // 2025-09-27 for 2025-09-26
    'e61ce00fd0594bcde256f5283582e49c40628c5b', // 2025-09-30 for 2025-09-29
    '87cd32c0b3c05595b0187d020f1cdd78e5ce73bf', // 2025-10-02 for 2025-10-01
    'c863733ffa8f82dff3d763064d1cda30bfcb83cf', // 2025-10-02 for 2025-10-01
    '823096e9d30eab7037111326bb663f5ea4b56da6', // 2025-10-03 for 2025-10-02
    '7c7e5ed2c72dfb7f8aa1b7dc256a1fd13871ae51', // 2025-10-04 for 2025-10-03
    '6986e0cd9a64eb8274a520c2473c36e2e65ff1e9', // 2025-10-05 for 2025-10-04
    '34192ee1ab2142731fad21f026527fdcee6e1584', // 2025-10-06 for 2025-10-05
    '921a2ebeff62eac546ec2a376ba0c215df095f94', // 2025-10-07 for 2025-10-06
    '6954a4c4ba8a6a8a34bd71a832cb297d87c97d08', // 2025-10-08 for 2025-10-07
    '0529cc505818edc16f1ed04ced914ffdb79732b2', // 2025-10-10 for 2025-10-09
    '0333d082a4417a08261273bdeecfc4ab3cd4eccf', // 2025-10-11 for 2025-10-10
    '0866f170eb681b1d23ccc33ffc8771b97051be03', // 2025-10-11 for 2025-10-10
    '130f52c5668d2404807b1857ee569f6c0a915bb2', // 2025-10-11 for 2025-10-10
    '175c3da63e54727a8761016478608a36c49246d2', // 2025-10-11 for 2025-10-10
    '25ce1f3c9a015145584ac6a27f77e202778ea6e9', // 2025-10-11 for 2025-10-10
    '309f910a046ba2dac5ba9a2b9b813e80fa0aaa50', // 2025-10-11 for 2025-10-10
    '338aa7c3dbb3f1568c3e8704ceb37053c1402d0e', // 2025-10-11 for 2025-10-10
    '444aed2ecb8da0f63171818e74dbda07eb712d3e', // 2025-10-11 for 2025-10-10
    '6efa80f94f496370287cdb3d575e753778309a8f', // 2025-10-11 for 2025-10-10
    '71ae4f0f67a9b8f47770bd0e5be146739bfde9d7', // 2025-10-11 for 2025-10-10
    '7ad2584053e627cedd8e4119e56c11a2d10a3aa6', // 2025-10-11 for 2025-10-10
    '7d6f02aaa2783269230b6bde0886a94a8e4b8906', // 2025-10-11 for 2025-10-10
    'efd3b56879c835a1d986893c0bb80de69fefec66', // 2025-10-11 for 2025-10-10
    'f7b8b173c662ce8d43e737ae9aba73c24afcc749', // 2025-10-11 for 2025-10-10
]);
