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

export function isBotIpHash({ hashedIpAddress, destinationServerUrl, asn, agentName, deviceName, regionCode, date }: { hashedIpAddress: string, destinationServerUrl: string, asn: string, agentName: string | undefined, deviceName: string | undefined, regionCode: string, date: string }): boolean {
    return botIpHashes.has(hashedIpAddress)
        || asn === '16591' && regionCode === 'TX' && agentName === 'Chrome' && deviceName === 'Windows Computer' && destinationServerUrl.includes('/ondemand.kut.org/') && destinationServerUrl.includes('kut-news-now') // google fiber
        || asn === '33425' && agentName === 'Mozilla/5.0 (compatible; V/1.0)' // coreweave (see below)
        || asn === '14618' && agentName === 'Chrome' && regionCode === 'VA' && deviceName === 'Apple Computer' && date === '2025-12-20' // amazon
        ;
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
    '06f676292c8d87007ec3ec79f63c87c1fd05d0f0', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    '1bf55306666f3064ffa84a5c5d0caa249b3df6dd', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    '35e193bb70d73097b16f98dd284e45c73b123bf1', // 2025-10-12 for 2025-10-11 398465 rackdog  Chrome
    '436e2b2c3f0e081249335e5861ea86d6d353bdc8', // 2025-10-12 for 2025-10-11 398465 rackdog  Chrome
    '5610c6f4409f62e6c9800bd7f71c84c42e6e4124', // 2025-10-12 for 2025-10-11 398465 rackdog  Chrome
    '56d538b9b548563f39da16d1dfdf23aa35786b6e', // 2025-10-12 for 2025-10-11 396982 google   Chrome,Safari
    '7445432cc3b887d16924889f0387f437ea77b027', // 2025-10-12 for 2025-10-11 398465 rackdog  Chrome
    '74eb7c52d6b182f036ed60c9bb64552c793f9b63', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    '7d2ff41411bb8ec9bf144371462b55faf5a63000', // 2025-10-12 for 2025-10-11 396982 google   Chrome,Safari
    '7ec34b4cb6e8302fcf01f7592aeafa174468f773', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    '815c4dbb996ddeac66ad61027f236baf9eae93bf', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    '8dca93c9b69b1618b16249a917261002823de91f', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    '9315a9cc0880a83b5ec88b66f668688569fb6220', // 2025-10-12 for 2025-10-11 398465 rackdog  Chrome
    'a4a11721f7f0bb216a763f1743e58de9a34e05f8', // 2025-10-12 for 2025-10-11 398465 rackdog  Chrome
    'c60ee802f425a3b920059be546c2a602c755ae8e', // 2025-10-12 for 2025-10-11 396982 google   Chrome,Safari
    'cd59ea79296cdc41db82e2d25cdb17c8e7ec5145', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    'df752bbf6661373ce93531c63a4b07f2e7a4d936', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    'f8545b85516ad67c513a56c2b8fd945950d2d004', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    'feb09ba8632f7ea2949006f7c02ea8a72bb7c400', // 2025-10-12 for 2025-10-11 399296 rackdog  Chrome
    '063a9d7e21093f8ab332570b02adcb539ca4e004', // 2025-10-13 for 2025-10-12 396982 google   Chrome,Safari
    'dd515123a500b40589eaee72905a75c92ec32a5d', // 2025-10-13 for 2025-10-12 396982 google   Chrome,Safari
    '2ad0ef923753591f8ecca3d0677ec08aaed98f93', // 2025-10-15 for 2025-10-14 396982 google   Chrome,Safari
    '21068f1fdbaa356ef89759c376c202b75b441b3d', // 2025-10-18 for 2025-10-16 204415 nexgen   Mozilla/5.0 (compatible; PodcastDownloader/1.0)
    '777956698b4b0f18d58d13f1eef8f61bd924b28f', // 2025-10-18 for 2025-10-16 209    century  Chrome
    '1c2eceb20f01f649aa3d7d6ed4b4d79128152d15', // 2025-10-20 for 2025-10-19 16509  amazon   Chrome
    '76933aa76d9d312492f453613075a769ba3eda65', // 2025-10-20 for 2025-10-19 16509  amazon   Chrome
    'a047086d66d44f7051f874479f78e03b7ef04c05', // 2025-10-20 for 2025-10-19 16509  amazon   Chrome
    'a0a823f7962ed7c912efcf174a64e80db50fb027', // 2025-10-20 for 2025-10-19 16509  amazon   Chrome
    'fb5cf927d28adb1a940a551c0ea0f22d1d61d7ac', // 2025-10-20 for 2025-10-19 24940  hetzner  Chrome,Safari,Edge,Firefox
    '30b64f29576d0239eb7d6c8f0ac4e7edcaebdf4f', // 2025-10-21 for 2025-10-20 12876  scaleway Mplayer, Windows Media Player
    '3c8be3e51b6b81462bee716cc30728aeead1346e', // 2025-10-21 for 2025-10-20 48090  dmzhost  Firefox
    'd69de8a319bd4b2b4d800b111ad0d7cb8e3ea5ee', // 2025-10-21 for 2025-10-20 16509  amazon   Chrome
    'cae9d8515527a5c84fe36713b2b279e23b8400ec', // 2025-10-22 for 2025-10-21 16509  amazon   Chrome
    '6259e266825587b0b4ce761925c2b02d9e0036b6', // 2025-10-22 for 2025-10-21 16509  amazon   Chrome
    '9fa41cc8729f8f9d1e4254cd5ad720b8ea6b2ed3', // 2025-10-23 for 2025-10-22 16509  amazon   Chrome
    'fe765bfd72275d6c22f60aa2b5f0c2039d7af0b7', // 2025-10-28 for 2025-10-27 396982 google   Chrome,Safari
    '2516177353bc8cd6637685248975a0263c76d78c', // 2025-10-30 for 2025-10-29 16509  amazon   poddl - podcast downloader
    '63640aea78cf162ee673ab7a4853099aef4ad9e1', // 2025-10-30 for 2025-10-29 16509  amazon   poddl - podcast downloader
    '92ee8dc4db8dc0751172885bca749f21b4de588a', // 2025-10-30 for 2025-10-29 16509  amazon   poddl - podcast downloader
    '97794061baa2ac7f9aef0446c892ddce2ea397c5', // 2025-10-30 for 2025-10-29 399296 rackdog  Chrome
    'b9aea9d2f837a5f22cb473dd2a31d42ca8dcd556', // 2025-10-30 for 2025-10-29 16509  amazon   poddl - podcast downloader
    'fc6efc2765ae71e82b7f4dfde89bc3da7cd8fc31', // 2025-10-30 for 2025-10-29 16509  amazon   poddl - podcast downloader
    '47192b18d73c54a44f2c107490342ec26f0e3491', // 2025-10-31 for 2025-10-30 16509  amazon   poddl - podcast downloader
    '69cccd48a717e0f83da36391fb0b64c1ac9dda0b', // 2025-10-31 for 2025-10-30 16509  amazon   poddl - podcast downloader
    '265eced116753bb7d47c903387d048d751190df0', // 2025-11-01 for 2025-10-31 202662 hytron   Chrome
    '628dcad0c6abcfaaf39dd352f2bf4da819c34c75', // 2025-11-01 for 2025-10-31 396982 google   Chrome,Safari
    '402c9e27aa09039a1ecc51897f6c2426624c0e34', // 2025-11-02 for 2025-11-01 396982 google   Chrome,Safari
    '6d70a6d5bbfbc5e5974a083cc6da3c1e29abd021', // 2025-11-02 for 2025-11-01 202662 hytron   Chrome
    '91026456749015bcbeb9e2f265ed746bdbdcd6ed', // 2025-11-02 for 2025-11-01 7922   comcast  Chrome,Safari,Edge,Firefox,Opera
    '99637dd8cc4969338f809ff7b9e15986b71d5cb3', // 2025-11-02 for 2025-11-01 396982 google   Chrome
    'a312bf280cad74c81b35129c659900269851715d', // 2025-11-02 for 2025-11-01 396982 google   Chrome,Safari
    'c626fb2d3b1bb93f6ca8c3e9a43f32cccbc1f426', // 2025-11-02 for 2025-11-01 396982 google   Chrome,Safari
    'fe3aaf8e15a7247337745b97adda8f0e7ce8df03', // 2025-11-02 for 2025-11-01 24940  hetzner  Chrome,Safari,Edge,Firefox
    '39bff10160c2268dc5941abca5e346bbe1b08cda', // 2025-11-05 for 2025-11-04 30600  metronet Overcast
    '3cc81df3374645d8abfa259844428aa602e9e210', // 2025-11-05 for 2025-11-04 24940  hetzner  Chrome,Safari,Edge,Firefox
    '442553039dedd201e0e750ac8fd446b74c19044a', // 2025-11-05 for 2025-11-04 812    rogers   Overcast
    'c6de8def59101c25cda6d023a99558c4610e804d', // 2025-11-05 for 2025-11-04 7018   att      Overcast
    'ea146eb5098e9e27b4822356965bdfe0ac1429cd', // 2025-11-05 for 2025-11-04 812    rogers   Overcast
    '00d099300155e7ecd2555f71b16bb3c2d09002e7', // 2025-11-05 for 2025-11-02 577    bellcan  Overcast
    '241c3e1717177e9005d5642701e682e64281c628', // 2025-11-05 for 2025-11-03 6167   vzbus    Overcast
    '29bc149c6dcaa4d527ca3c8524baa8f5c5ad33d0', // 2025-11-05 for 2025-11-01 812    rogers   Overcast
    '325a25afe3588d3a41098864eea6636b10371d9a', // 2025-11-05 for 2025-11-01 812    rogers   Overcast
    '3d5c2df28ab2c1b5fb20bb3df535ae86432b7ce6', // 2025-11-05 for 2025-11-03 812    rogers   Overcast
    '93f51ee9044fde0a8572f6e9435dd5997806de6a', // 2025-11-05 for 2025-11-02 812    rogers   Overcast
    'c5a0b63ec8b838b8f169aea99a80fe26eb160459', // 2025-11-05 for 2025-11-02 812    rogers   Overcast
    '54b278ee6585ed1b8e215b8f4d63779a54b2b54c', // 2025-11-06 for 2025-11-05 812    rogers   Overcast
    '5dc2ab340eb9359937ec7885015ba8d896975e56', // 2025-11-06 for 2025-11-05 812    rogers   Overcast
    'd79537b2e25cfb71eb3dee3a49889e5f000128d1', // 2025-11-06 for 2025-11-05 812    rogers   Overcast
    'dbc7c7a22fb21abb03945ec8c26ade17fcc9d890', // 2025-11-06 for 2025-11-05 812    rogers   Overcast
    'f619cac77bc8ca779510c60409d5493267f7245e', // 2025-11-06 for 2025-11-05 812    rogers   Overcast
    '8cb261c78dad3efcd48d940c3f5e77f263ea7bbf', // 2025-11-06 for 2025-11-05 3352   telefonica Overcast
    '01b3e6295170048c5cd7b8cf547c969075a389ed', // 2025-11-07 for 2025-11-06 812    rogers   Overcast
    '0cd29ac1619162228d7803687a88073060284d10', // 2025-11-07 for 2025-11-06 25820  it7      Chrome
    '2e72a00adccf985b83df9de368d390da91b89b23', // 2025-11-07 for 2025-11-06 701    verizon  Overcast
    '8b9ce9738c7647199a1240f6c41966ab7ad68243', // 2025-11-07 for 2025-11-06 812    rogers   Overcast
    '9b45aca69b1d61a927ad1dd0d8238ac801cda0c1', // 2025-11-07 for 2025-11-06 25820  it7      Chrome
    'a6da9f1f3aafd46d46dfc8a385397620d2c593c3', // 2025-11-07 for 2025-11-06 25820  it7      Chrome
    'dd0078339e6da6546348c0c954f6f60776bdb494', // 2025-11-07 for 2025-11-06 812    rogers   Overcast
    'e198962f37bc5060f4bd9a8481a18e7047430523', // 2025-11-07 for 2025-11-06 25820  it7      Chrome
    'ecbcfb4f15bff76857bd65bcff5961b712486097', // 2025-11-07 for 2025-11-06 25820  it7      Chrome
    '54112768e3f5823b6eb938c7993bcb4a7d194323', // 2025-11-08 for 2025-11-07 16509  amazon   Chrome
    'a4f08a570d2f21b65a3f332651cc389043206ac8', // 2025-11-08 for 2025-11-07 12119  itv3     Overcast
    'e49a3868aec3927e1914d51c09c27ec13f0e8083', // 2025-11-08 for 2025-11-07 812    rogers   Overcast
    '80a88f03d467b5c3fb915f878fb23c13d82cf8a1', // 2025-11-09 for 2025-11-08 4837   chinauni Chrome
    '8ece917829ad44ba694a723c9bec628fc8264520', // 2025-11-09 for 2025-11-08 11427  charter  Overcast
    '0c8480fbbd158bce4b29fcc8889c128ee5abb16c', // 2025-11-10 for 2025-11-09 16509  amazon   Chrome
    '97c764577483c41d7b1fd880cfaa33af898f88ec', // 2025-11-10 for 2025-11-09 16509  amazon   Chrome
    '1303a5aea99bbf6aadea082e26cdae4586a5305d', // 2025-11-10 for 2025-11-09 812    rogers   Overcast
    '486d0b1138fbf8633e538a8d2218fb0caea6a00d', // 2025-11-10 for 2025-11-09 812    rogers   Overcast
    '98884dda13bf9e30cb6ce043707d606d6bcf43d1', // 2025-11-10 for 2025-11-09 18403  fpt      Dalvik
    'b483d3d32f245a059398f81919216ea1950f4a73', // 2025-11-10 for 2025-11-09 132817 dzcrd    Chrome
    '83ce17496be6b511df9c5c042348e35b3bf7ad1d', // 2025-11-11 for 2025-11-10 812    rogers   Overcast
    'bc5c94a17370bb4cc09a7576a9f2cdcdded5b945', // 2025-11-11 for 2025-11-10 9009   m247     Chrome
    'd5c27f0f3b2b11915a71bd05b7d591897af2cde3', // 2025-11-11 for 2025-11-10 9009   m247     Chrome
    'dfe9e983a7acd64f65482a018246cf0b05098992', // 2025-11-11 for 2025-11-10 812    rogers   Overcast
    '109d1beeb592d4314ad31c8d5000ad4d064b0a42', // 2025-11-12 for 2025-11-11 16509  amazon   Chrome
    '2c91f0c49c0e1795e08f75cbf34f471c128872dd', // 2025-11-12 for 2025-11-11 16509  amazon   Chrome
    '31337704dcecc3999e59bf6c9f6e1be60cf378f2', // 2025-11-12 for 2025-11-11 812    rogers   Overcast
    '94748497c1fc9a916fad5b51710026140b126eba', // 2025-11-12 for 2025-11-11 812    rogers   Overcast
    'f32ecf774bab947b1adb5a07fde6a8107b55eb09', // 2025-11-12 for 2025-11-11 812    rogers   Overcast
    '572e1028f4afefe97ad604225958282492f27699', // 2025-11-12 for 2025-11-11 16509  amazon   Chrome
    '8a5aedf162d92d8d7439c89b1ea6870f2c4c5965', // 2025-11-12 for 2025-11-11 16509  amazon   Chrome
    '991ecd570a2d55b489986f0fb124c3c88ecc8de8', // 2025-11-12 for 2025-11-11 16509  amazon   Chrome
    'e284de463bf218a93031ecc6bc356cd05045909d', // 2025-11-12 for 2025-11-11 16509  amazon   Chrome
    'f5e9f828393bfb80add6fbb8816634a05b9af012', // 2025-11-12 for 2025-11-11 16509  amazon   Chrome
    '03f09f1673ba592cbe224bce0b0443773c086fd2', // 2025-11-13 for 2025-11-12 62874  web2obj  Chrome
    '0d512f4c886c7045aa077213c8fb0a68a032fd32', // 2025-11-13 for 2025-11-12 16509  amazon   Chrome
    '26208b6ae99780ba1a8d7c403b988abd92621de8', // 2025-11-13 for 2025-11-12 812    rogers   Overcast
    'c53a1ac8fa0f79764c016bdb725bf8cab51c25db', // 2025-11-13 for 2025-11-12 812    rogers   Overcast
    'cf9657f886e0a050be8215e69d4bcbde752a65c0', // 2025-11-13 for 2025-11-12 12876  scaleway MPlayer, Windows Media Player
    '4c4f0fb17f89fbf2fb69b2be8ef9c0030fa1753c', // 2025-11-14 for 2025-11-13 812    rogers   Overcast
    '7cb4d07418e059efab22f05002e96ce6b4f635e2', // 2025-11-14 for 2025-11-13 812    rogers   Overcast
    '31080a7abab9047e56ee06be96b98b8780beff83', // 2025-11-15 for 2025-11-14 212238 datacamp Chrome
    '745da2ead0ca8146cb2e561d970b4d695afd48ae', // 2025-11-16 for 2025-11-15 13335  cloudflare Chrome
    '239777f4527a31a5c21087cef90ba41b466d42cf', // 2025-11-18 for 2025-11-17 16509  amazon   Chrome
    'd9df76bd6bd0c45e185ddb7bee18e2af3f2f6c04', // 2025-11-18 for 2025-11-17 16509  amazon   Chrome
    'ae622ff3f5aaed93c4c14aa18c477d7a1f10d130', // 2025-11-18 for 2025-11-17 212238 datacamp Chrome
    '3995b9d85cc005f77372d33d027a1b45861059ab', // 2025-11-19 for 2025-11-18 3352   telefonica Overcast
    '9ae7320d4429af77566b2088f11afbed91d071d5', // 2025-11-19 for 2025-11-18 16509  amazon   Chrome
    'd28da9aff1011e3d12202dd6e83ed5d2006f13cc', // 2025-11-19 for 2025-11-18 16509  amazon   Chrome
    '14b92055924ca372fb04c94b052acf504132809b', // 2025-11-20 for 2025-11-19 14618  amazon   Chrome
    '8726a14f3308d3f3cc4bbce289b08abb57ed653b', // 2025-11-20 for 2025-11-19 13335  cloudflare Chrome
    'd35a967c93b3596be148f1803b246fb5538214c6', // 2025-11-20 for 2025-11-19 12479  orange   Overcast
    'eedd2f9af3978baa73acb59a5c404b53e56fc63e', // 2025-11-20 for 2025-11-19 396982 google   Storytel
    '251249e0e4150bc54003d258fc13b20646b5288a', // 2025-11-22 for 2025-11-21 48090  dmzhost  Firefox
    'd3af17836ac94953b033f9e82001a2f343828b3a', // 2025-11-23 for 2025-11-22 7545   tpg      Overcast
    'fcd523c1e93e1292807ce9a9a2965ce74c372a06', // 2025-11-23 for 2025-11-22 7545   tpg      Overcast
    '262191ebfe7487d9bb6b084ffd47af3d34346d30', // 2025-11-24 for 2025-11-23 142125 capti    Overcast
    '8fd7e80eec1b564caa8c8ae8dcc7b9d14bf01f90', // 2025-11-24 for 2025-11-23 137409 gsl      Overcast
    'c01570708935959bea8d17fc0367d70c5ecefc08', // 2025-11-25 for 2025-11-24 7545   tpg      Overcast
    'dc9590518199ba17630e1c0b5eead5ba4161dfe0', // 2025-11-25 for 2025-11-24 137409 gsl      Overcast
    '3308a56a9e02f9aec00957bf93e3eb18ed336b9b', // 2025-11-26 for 2025-11-25 812    rogers   Overcast
    '50b4b15e5d5b9ad6dea564ff9af1d401aa591a19', // 2025-11-26 for 2025-11-25 396982 google   Storytel
    '957a00e8f65fadbee02fdc74ac75c9e2882c59a2', // 2025-11-26 for 2025-11-25 812    rogers   Overcast
    'e5bdfeca1e3418a8426d63c1656d50609cfe518c', // 2025-11-26 for 2025-11-25 812    rogers   Overcast
    'fdb339276e627b4b64acc1d88e5bf80f8434adbd', // 2025-11-26 for 2025-11-25 28573  claro    Overcast
    '130da9fc2f59251d1099810353341079752c2900', // 2025-11-27 for 2025-11-26 931    hyonix   Chrome,Edge
    '7a92e26c7f0cbbc6114e674896368e870cad6e28', // 2025-11-27 for 2025-11-26 132203 tencent  Chrome,Safari,Edge,Firefox,Google Podcasts
    'a019e0da47c5d5b2aab22593b162fc8eda31e7ed', // 2025-11-27 for 2025-11-26 137409 gsl      Firefox
    'a3c8685716597956d0a1fab0e0eddde35f5628b6', // 2025-11-27 for 2025-11-26 812    rogers   Overcast
    '14401effc9138387d032813a861218a6fb571ce4', // 2025-11-28 for 2025-11-27 33425  coreweave Mozilla/5.0 (compatible; V/1.0)
    '3ce7002ff35ff798627cd2b6e72105bc6d900703', // 2025-11-28 for 2025-11-27 33425  coreweave Mozilla/5.0 (compatible; V/1.0)
    '928ae3f54ac4dba7b90a8834e286d2a1559cbea9', // 2025-11-28 for 2025-11-27 33425  coreweave Mozilla/5.0 (compatible; V/1.0)
    'b93a274b50849655002cb324608f5da9b1738184', // 2025-11-28 for 2025-11-27 33425  coreweave Mozilla/5.0 (compatible; V/1.0)
    'bea7c969885f217462b612769ade259ac9dc090a', // 2025-11-28 for 2025-11-27 33425  coreweave Mozilla/5.0 (compatible; V/1.0)
    'ff5ddebd318f6b7c6c756f161eca586d3e583638', // 2025-11-28 for 2025-11-27 33425  coreweave Mozilla/5.0 (compatible; V/1.0)
    '5f9f65d90dddbe3148936fa090f438be00129897', // 2025-11-28 for 2025-11-27 137409 gsl      Overcast
    'c8d43cefb0c7cbcdfff4772e299441c2adfd08ec', // 2025-11-28 for 2025-11-27 812    rogers   Overcast
    'f068b46d977691bc25b923739895f14b690e3c9b', // 2025-11-28 for 2025-11-27 142125 capti    Overcast
    '4b910e5aa623ab46ae6a64923a196e7b3fd832ce', // 2025-11-29 for 2025-11-28 4713   docomo   Chrome
    'affc2652097ddb641731bae94b3bee621dec88cf', // 2025-11-30 for 2025-11-29 812    rogers   Overcast
    '758f87aab95732a9bd7c0fb69facce5f6abaa91e', // 2025-12-01 for 2025-11-30 812    rogers   Overcast
    '39df19da3ce608e6c5ef496b489738d520714543', // 2025-12-02 for 2025-12-01 6167   verizon  Overcast
    '76fc5e3c62d4d406b49ecc97248302ea5459352d', // 2025-12-02 for 2025-12-01 212238 datacamp Chrome
    'e241555d5ba98fb9545e215523a1f3e0fdd4f127', // 2025-12-02 for 2025-12-01 30600  metronet Overcast
    'fa63872fc57d794b7249767c4c5f2b1ecebf6173', // 2025-12-02 for 2025-12-01 3352   telefonica Overcast
    '2703e00f5fe808d6a6206dc22db6efc214beebd5', // 2025-12-03 for 2025-12-02 57269  digispain Overcast
    '9978c2a27ee141b9240ba5f4922c92a43edb6343', // 2025-12-03 for 2025-12-02 7922   comcast  Overcast
    'fb8667ae5695a51fbe2d8d7d68762a8058422532', // 2025-12-03 for 2025-12-02 12119  itv3     Overcast
    'd5d958d04449f1c55f574162cb5489f9589165dc', // 2025-12-03 for 2025-12-02 137409 gsl      Firefox, Safari, Podcast Addict, stagefright
    '686ea059441592dd280628f1a1485769cca3f7c3', // 2025-12-04 for 2025-12-03 7922   comcast  Overcast
    '77ff6109958918afd0d64efe1279aace1cbbae6a', // 2025-12-04 for 2025-12-03 12479  orange   Overcast
    '97b66f73ee04089c87234c72c82590bce3881a66', // 2025-12-04 for 2025-12-03 136787 packethub Overcast
    'a45f1cc2c2dd1af85607000c18da89aa0c44f203', // 2025-12-04 for 2025-12-03 4812   chinatelecom Firefox
    'b1e9780e3591310b55c76a811312d6c5c15da296', // 2025-12-04 for 2025-12-03 9299   philippine Podurama
    'c5bbd13c52a17f4c1f67850c653ebd8b694617ba', // 2025-12-04 for 2025-12-03 48090  dmzhost  Firefox
    'b715605af60070cc40d82bb19b3274f71f5e7a59', // 2025-12-05 for 2025-12-04 16509  amazon   Chrome
    '1ee1b2aa3b8d64efe15e53be2efff7da3236d391', // 2025-12-06 for 2025-12-05 16509  amazon   Chrome
    'a332cbc244ac45016020e171f73d5fe287283450', // 2025-12-06 for 2025-12-05 16509  amazon   Chrome
    '5398eb8adac2422ca7767abbb1295d16678bc61f', // 2025-12-07 for 2025-12-06 58065  packet   Chrome, Firefox
    '55dade2ad5ecc7069efb6a63409611ccc7d7813f', // 2025-12-08 for 2025-12-07 803    sasktel  Firefox
    'b5cbf4655cbde3b1e2d5cb55409a3b3473199c5b', // 2025-12-09 for 2025-12-08 141039 packethub Overcast
    '50b6824775f84f9922e04827f739592ebf321e73', // 2025-12-10 for 2025-12-09 141039 packethub Overcast
    '6d82a3fedf63363b27d9647858b43b13498a74a9', // 2025-12-10 for 2025-12-09 53850  gorilla  Chrome
    '8f325e94eb4880753526c8724f50eae5d9628752', // 2025-12-10 for 2025-12-09 16509  amazon   Chrome
    'ee0302cd473b235dbfcca4a42dda66856760c644', // 2025-12-10 for 2025-12-09 141039 packethub Overcast
    '7c54589378df3adc8bf5b1d661d513174cf51de9', // 2025-12-11 for 2025-12-10 11351  charter  Chrome
    'cf3112fe57a843c46e728a5ddbe2d5089951fd35', // 2025-12-11 for 2025-12-10 45090  tencent  Chrome, Firefox, Edge, Safari
    '8668d7a3b43fa110eade86a3360b6df56094955b', // 2025-12-13 for 2025-12-12 48090  techoff  Firefox
    'c0c3813ce46dc86e5903d419b3be8345a6698516', // 2025-12-13 for 2025-12-12 395965 carrytel Chrome
    '236f05b2102ab54b9b7e5675ba5092e5f217501e', // 2025-12-16 for 2025-12-15 7018   att      Overcast
    '7ccc558874175988e511afde0ea5ba4668845862', // 2025-12-16 for 2025-12-15 812    rogers   Overcast
    'd366c427875f90e64cfb16d5a61981a47832ed6a', // 2025-12-16 for 2025-12-15 812    rogers   Overcast
    'faff1fe55396bb4a3f4646845d8d1b860d7665fa', // 2025-12-16 for 2025-12-15 3320   telekom  Overcast
    '7257f838209fb68d70e1416123be77939ce5e82e', // 2025-12-17 for 2025-12-16 812    rogers   Overcast
    '970a932a73589af8fdccabae89e5d6ec05ee2411', // 2025-12-17 for 2025-12-16 812    rogers   Overcast
    'a3d5c705fd8a658c29dffc9a0a73088bfb31e976', // 2025-12-17 for 2025-12-16 812    rogers   Overcast
    'be184ea32738ff68930a08a437146b6811c6d109', // 2025-12-17 for 2025-12-16 812    rogers   Overcast
    'e57239eb5a9731c9729880787c3878188548ad5b', // 2025-12-17 for 2025-12-16 812    rogers   Overcast
    'eee8bad0865d3740d9ff7d76c38ece95e6752b17', // 2025-12-17 for 2025-12-16 812    rogers   Overcast
    '7b135c897236a039f4f5d0b0cfe5c69dffb97fa3', // 2025-12-17 for 2025-12-16 136787 packethub Overcast
    '06509fa1b0ad4dcc6ece1fd5ee11ea3c14c7bfa9', // 2025-12-18 for 2025-12-17 396982 google   Safari, Chrome
    '69a25c78acf8a89147b94c2fea18831b7394e932', // 2025-12-18 for 2025-12-17 396982 google   Safari, Chrome
    '73238592035cd081c6f42e70aec59bc21591f9f2', // 2025-12-18 for 2025-12-17 396982 google   Safari, Chrome
    '74bceb64e32d15ff244216cd85f2b17beadc8892', // 2025-12-18 for 2025-12-17 396982 google   Safari, Chrome
    'd0324308a0cbfd944cae0ecd53443d3478aa1047', // 2025-12-18 for 2025-12-17 396982 google   Safari, Chrome
    'e5f4fd09355da80bdd45e68df6274e37aaa66dc1', // 2025-12-18 for 2025-12-17 396982 google   Safari, Chrome
    'ebfe7d1ba3f3aee90178881eebd4c3541219a047', // 2025-12-18 for 2025-12-17 396982 google   Safari, Chrome
    'c74e4942c52b56214ab307a94c599a8e2ba02b15', // 2025-12-18 for 2025-12-17 396982 google   Safari, Chrome, feedparser/6.0.11 +https://github.com/kurtmckee/feedparser/
    '4a1a5328c28f04a1297502df016ba28b10f23155', // 2025-12-18 for 2025-12-17 812    rogers   Overcast
    '4c411f183456460e6ebf166144430d674560407a', // 2025-12-18 for 2025-12-17 812    rogers   Overcast
    'be579bf37339f127f71a236be73026ce9ef1b4d9', // 2025-12-18 for 2025-12-17 136787 packethub Overcast
    'ab1a376685d5be76db10d2440e65e2fdb1a5fb14', // 2025-12-18 for 2025-12-17 7018   att      Chrome, Safari, Edge
    '59439b110921e0a4dc1c7e8085cde7c626659528', // 2025-12-19 for 2025-12-18 701    verizon  Overcast
    '946609890b912f71cdb0d3f9c9716e1c6e57d3eb', // 2025-12-19 for 2025-12-18 701    verizon  Overcast
    'd6f7d90305749ba2ee83683c6a48fb810299f338', // 2025-12-19 for 2025-12-18 812    rogers   Overcast
    'a890565ec59220220026f4e092afe05201c95d83', // 2025-12-19 for 2025-12-18 16509  amazon   Chrome
    '0da080c7fca448d9848d1a33a9df88efac8fa7c6', // 2025-12-20 for 2025-12-19 7922   comcast  node
    '39b8478b4aca67ab2a72b31be123f44cc37dd185', // 2025-12-20 for 2025-12-19 812    rogers   Overcast
    '7aa0102ea37ea7806d7f846aa5017f82795c0133', // 2025-12-20 for 2025-12-19 812    rogers   Overcast
    'd2e5baefd78214b33c6cb945198f795b257232e7', // 2025-12-20 for 2025-12-19 812    rogers   Overcast
    'e75e4c4128e0624579e3a84c8ad682ea6162ea29', // 2025-12-20 for 2025-12-19 812    rogers   Overcast
    '3c5386a16e2cce26d0d7b23e3b16a9c7af85f5d8', // 2025-12-20 for 2025-12-19 577    bellcan  Overcast
    '018d6bf6cd0e4683de78d435a161c8c2e5c89310', // 2025-12-21 for 2025-12-20 14618  amazon   Chrome
    '0c4a2dab197492741b90a7ff25a2eecedce87acc', // 2025-12-21 for 2025-12-20 14618  amazon   Chrome
    'c0594373423ac15f264237f6d9b2bc9d261a59c0', // 2025-12-21 for 2025-12-20 14618  amazon   Chrome
    'cd49a7007b115760a3c1059a374c801619fd699a', // 2025-12-21 for 2025-12-20 14618  amazon   Chrome
    'dac6f43062faba6923c7d502987a263f8e94a966', // 2025-12-21 for 2025-12-20 14618  amazon   Chrome
    '076d2f532523d54495c1db694e1b5ccb68c382b1', // 2025-12-21 for 2025-12-20 141039 packethub Overcast
    'a88758e87fe2a6d4dd57ee80d4e203bcfe72bbf0', // 2025-12-21 for 2025-12-20 26599  telefonica Overcast
    'f5734ed3cb316e6b13854f477ce8135848dd159d', // 2025-12-21 for 2025-12-20 812    rogers   Overcast
    '30ae21febe928f417c82e7354db3ce37487244f2', // 2025-12-22 for 2025-12-21 26599  telefonica Overcast
    '973ae5d59878393d15c22918dacff2af89f5d606', // 2025-12-22 for 2025-12-21 33915  vodafone Overcast
    'c6870bff35698fff7326783308b00a35462798d0', // 2025-12-22 for 2025-12-21 33915  vodafone Overcast
    'e476320fdbcfb5a7134f9d3d2dfca07bed7172d5', // 2025-12-22 for 2025-12-21 812    rogers   Overcast
    'e76387da2432d71872c60afbb33f574f7834f7c2', // 2025-12-22 for 2025-12-21 812    rogers   Overcast
    'f08547159f6a248c50e1813c109ae1eefce45068', // 2025-12-22 for 2025-12-21 812    rogers   Overcast
    '5138d288a2712a68a18689db1d2bee9ba4db296f', // 2025-12-23 for 2025-12-22 812    rogers   Overcast
    'bb3a0792b826da7209b5cdd30270f9bfc0055df0', // 2025-12-23 for 2025-12-22 812    rogers   Overcast
    '6f0bc0558e3eecbc3118f058942842febe783dd7', // 2025-12-23 for 2025-12-22 28573  claro    Overcast
]);
