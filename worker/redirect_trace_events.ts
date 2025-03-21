import { parseApplePodcastsUserAgent } from './apple_podcasts_ua.ts';
import { computeBotType } from './backend/bots.ts';
import { computeAgentInfo } from './backend/downloads.ts';
import { computeChainDestinationHostname, computeChainDestinationUrl } from './chain_estimate.ts';
import { check, checkMatches, isValidInstant, } from './check.ts';
import { computeServerUrl } from './client_params.ts';
import { getCachedString } from './cloudflare_configuration.ts';
import { computeOther } from './cloudflare_request.ts';
import { hmac, importHmacKey } from './crypto.ts';
import { Bytes, CfCache, KVNamespace } from './deps.ts';
import { computeIpAddressForDownload } from './ip_addresses.ts';
import { RedirectRequest } from './routes/redirect_episode.ts';
import { RawRedirect } from './rpc_model.ts';
import { BannedRedirect, InvalidRedirect, ValidRedirect } from './tracer.ts';
import { isValidUuid } from './uuid.ts';

type Opts = { request: Request, redirectRequest: RedirectRequest, validRawRedirect: RawRedirect | undefined, rawIpAddress: string, banned: boolean | undefined, cache: CfCache, kvNamespace: KVNamespace | undefined };
export async function computeRedirectTraceEvent({ request, redirectRequest, validRawRedirect, rawIpAddress, banned, cache, kvNamespace }: Opts): Promise<ValidRedirect | InvalidRedirect | BannedRedirect> {
    const { colo = 'XXX', country = 'XX', asn: asnStr, regionCode, region, timezone, metroCode } = computeOther(request) ?? {};
    const { url, headers } = request;
    const destinationHostname = computeChainDestinationHostname(url) ?? '<unknown>';
    const userAgent = headers.get('user-agent') ?? undefined;
    const referer = headers.get('referer') ?? undefined;
    const hasForwarded = headers.has('forwarded');
    const hasXForwardedFor = headers.has('x-forwarded-for');
    const ipAddressShape = rawIpAddress === '<missing>' ? '' : rawIpAddress.replaceAll(/[a-z]/g, 'a').replaceAll(/[A-Z]/g, 'A').replaceAll(/\d/g, 'n');
    const ipAddressVersion = /^n{1,3}\.n{1,3}\.n{1,3}\.n{1,3}$/.test(ipAddressShape) ? 4 : ipAddressShape.includes(':') ? 6 : 0;
    const ipAddressKnown = rawIpAddress === '2a06:98c0:3600::103' ? 'crosszone' : undefined; // https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip

    const errors: string[] = [];
    function trySync<T>(error: string, fn: () => T): T | undefined {
        try {
            return fn();
        } catch (e) {
            console.warn(`${e.stack || e}`);
            errors.push(error);
        }
    };
    async function tryAsync<T>(error: string, fn: () => Promise<T>): Promise<T | undefined> {
        try {
            return await fn();
        } catch (e) {
            console.warn(`${e.stack || e}`);
            errors.push(error);
        }
    };

    let timeUuid: string | undefined;
    let botType: string | undefined;
    let hashedIpAddress: string | undefined;
    let hashedIpAddressForDownload: string | undefined;
    let audienceIdDownloadId: string | undefined;
    let audienceIdDownloadId2: string | undefined;
    let destinationServerUrl: string | undefined;
    let apVersion: number | undefined;
    let cfVersion: number | undefined;
    let dwVersion: number | undefined;
    let usedXForwardedFor = false;

    const asn = typeof asnStr === 'string' ? trySync('asn', () => parseInt(asnStr)) : undefined;
    const { agentType, agentName, deviceType, deviceName, referrerType, referrerName, isWebWidget } = computeAgentInfo({ userAgent, referer });
    const agentTypeAgentName = `${agentType.padEnd(11, ' ')}-${agentName ?? ''}`;
    const deviceTypeDeviceName = deviceType ? `${deviceType.padEnd(13, ' ')}-${deviceName ?? ''}` : undefined;
    const referrerTypeReferrerName = referrerType ? `${referrerType.padEnd(6, ' ')}-${referrerName ?? ''}` : undefined;
    const regionCodeRegionName = regionCode ? `${regionCode.padEnd(3, ' ')}-${region ?? ''}` : undefined;
    if (validRawRedirect) {
        const { time, uuid, ipSource } = validRawRedirect;
        usedXForwardedFor = ipSource === 'x-forwarded-for';
        timeUuid = trySync('time-uuid', () => {
            const instant = new Date(time).toISOString();
            check('instant', instant, isValidInstant);
            check('uuid', uuid, isValidUuid);
            return `${instant}-${uuid}`;
        });

        if (timeUuid) {
            const date = timeUuid.substring(0, 10);
            botType = trySync('bot-type', () => {
                const tags = isWebWidget ? 'web-widget' : '';
                return computeBotType({ agentType, agentName, deviceType, referrerName, tags, date });
            });
            const month = date.substring(0, 7);
            if (kvNamespace) {
                hashedIpAddress = await tryAsync('ipaddr', async () => {
                    if (rawIpAddress === '<missing>') return undefined;
                    return (await hmac(Bytes.ofUtf8(rawIpAddress), await getHmacKeyForMonth(month, kvNamespace, cache))).hex();
                });
                hashedIpAddressForDownload = await tryAsync('ipaddr-for-download', async () => {
                    if (rawIpAddress === '<missing>') return undefined;
                    return (await hmac(Bytes.ofUtf8(computeIpAddressForDownload(rawIpAddress)), await getHmacKeyForMonth(month, kvNamespace, cache))).hex();
                });
            }
            if (hashedIpAddress || hashedIpAddressForDownload) {
                destinationServerUrl = trySync('destination-server-url', () => {
                    const serverUrl = computeServerUrl(url);
                    return computeChainDestinationUrl(serverUrl);
                });
            }
            if (hashedIpAddress && destinationServerUrl) {
                audienceIdDownloadId = await tryAsync('audience-id-download-id', async () => {
                    const audienceId = (await Bytes.ofUtf8(`${hashedIpAddress}|${userAgent}|${referer}`).sha256()).hex();
                    const downloadId = (await Bytes.ofUtf8(`${date}|${destinationServerUrl}|${audienceId}`).sha256()).hex();
                    return `${audienceId}-${downloadId}`;
                });
            }
            if (hashedIpAddressForDownload && destinationServerUrl) {
                audienceIdDownloadId2 = await tryAsync('audience-id-download-id-2', async () => {
                    const audienceId = (await Bytes.ofUtf8(`${hashedIpAddressForDownload}|${userAgent}|${referer}`).sha256()).hex();
                    const downloadId = (await Bytes.ofUtf8(`${date}|${destinationServerUrl}|${audienceId}`).sha256()).hex();
                    return `${audienceId}-${downloadId}`;
                });
            }
        }
    }
    const result = trySync('apua', () => {
        if (!userAgent || agentTypeAgentName !== 'app        -Apple Podcasts') return undefined;
        const result = parseApplePodcastsUserAgent(userAgent);
        if (result) {
            const { appVersion, cfVersion, dwVersion } = result;
            return { apVersion: packAppleVersion(appVersion), cfVersion: packAppleVersion(cfVersion), dwVersion: packAppleVersion(dwVersion) };
        }
    });
    if (result) {
        apVersion = result.apVersion;
        cfVersion = result.cfVersion;
        dwVersion = result.dwVersion;
    }

    return {
        kind: banned ? 'banned-redirect' : redirectRequest.kind === 'valid' ? 'valid-redirect' : 'invalid-redirect',
        colo, url, country, destinationHostname, userAgent: userAgent ?? '<missing>', referer : referer ?? '<missing>', hasForwarded, hasXForwardedFor, usedXForwardedFor, ipAddressShape, ipAddressVersion, ipAddressKnown,
        errors, asn, apVersion, cfVersion, dwVersion, timeUuid, botType, hashedIpAddress, hashedIpAddressForDownload, audienceIdDownloadId, audienceIdDownloadId2, agentTypeAgentName,
        deviceTypeDeviceName, referrerTypeReferrerName, regionCodeRegionName, timezone, metroCode,
     };
}

export function packAppleVersion(version: string): number { // 0000.1111.2222.3333 => 0000111122223333
    checkMatches('version', version, /^\d{4}(\.\d{4}){3}$/);
    const parts = version.split('.');
    return parts.reduce((prev, cur, i) => prev + parseInt(cur) * Math.pow(10, 4 * (parts.length - i - 1)), 0);
}

//

const hmacKeys = new Map<string, CryptoKey>();

async function getHmacKeyForMonth(month: string, kvNamespace: KVNamespace, cache: CfCache ): Promise<CryptoKey> {
    let key = hmacKeys.get(month);
    if (key) return key;
    const cached = await getCachedString(`redirects-hmac-${month}`, kvNamespace, cache);
    if (!cached) throw new Error(`Key not found for month ${month}`);
    if (!/^[0-9a-f]{128}$/.test(cached)) throw new Error(`Invalid key found for month ${month}`);
    key = await importHmacKey(Bytes.ofHex(cached));
    hmacKeys.set(month, key);
    return key;
}
