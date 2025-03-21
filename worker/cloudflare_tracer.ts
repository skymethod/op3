import { AnalyticsEngine, AnalyticsEngineEvent } from './deps.ts';
import { initTracer, TraceEvent } from './tracer.ts';

export function initCloudflareTracer(dataset: AnalyticsEngine | undefined) {
    if (!dataset) return;
    initTracer(event => {
        dataset.writeDataPoint(computeAnalyticsEngineEvent(event));
    });
}

export function setWorkerInfo(workerInfo: WorkerInfo) {
    _workerInfo = workerInfo;
}

export const MAX_BLOBS_SIZE = 5120; // "The total size of all blobs in a request must not exceed 5120 bytes."

export function computeBlobsSize(blobs: (ArrayBuffer | string | null)[] | undefined): number {
    const encoder = new TextEncoder();
    return (blobs ?? []).reduce((prev, cur) => prev + (typeof cur === 'string' ? encoder.encode(cur).byteLength : cur instanceof ArrayBuffer ? cur.byteLength : 0), 0);
}

export function computeAnalyticsEngineEvent(event: TraceEvent): AnalyticsEngineEvent {
    const { kind } = event;
    if (kind === 'error-saving-redirect') {
        const { colo, error, country, uuids } = event;
        return { blobs: [ kind, colo, trim(error), country, trim(uuids.join(',')) ], doubles: [ 1 ], indexes: [ kind ] };
    } else if (kind === 'valid-redirect' || kind === 'invalid-redirect' || kind === 'banned-redirect') {
        const { colo, country, hasForwarded, hasXForwardedFor, usedXForwardedFor, ipAddressShape, ipAddressVersion, ipAddressKnown, errors, asn = 0, apVersion = 0, cfVersion = 0, dwVersion = 0, timeUuid = null, botType = null, hashedIpAddress = null, hashedIpAddressForDownload = null, 
            audienceIdDownloadId = null, audienceIdDownloadId2 = null, deviceTypeDeviceName = null, regionCodeRegionName = null, timezone = null, metroCode = null } = event;
        let { url, destinationHostname, userAgent, referer, agentTypeAgentName = null, referrerTypeReferrerName = null } = event;
        if (typeof referer === 'string' && typeof referrerTypeReferrerName === 'string' && referrerTypeReferrerName.length > (6 + 1 + 1024)) {
            referrerTypeReferrerName = referrerTypeReferrerName.substring(0, 6 + 1 + 1024);
        }
        if (typeof userAgent === 'string' && userAgent.length > 1024 && typeof agentTypeAgentName === 'string' && agentTypeAgentName.includes(userAgent)) {
            agentTypeAgentName = agentTypeAgentName.replace(userAgent, trim(userAgent));
        }
        const bits = (hasForwarded ? 1 : 0) | (hasXForwardedFor ? 2 : 0) | (usedXForwardedFor ? 4 : 0);
        const errorCount = errors.length;
        const errorsOrIpAddressShape = errorCount > 0 ? errors.join(',') : trim(ipAddressShape);
        url = trim(url);
        destinationHostname = trim(destinationHostname);
        userAgent = trim(userAgent);
        referer = trim(referer);
        const ipAddressKnownCode = ipAddressKnown === 'crosszone' ? 1 : 0;
        // if (kind !== undefined) return { blobs: [ kind, colo, trim(url), country, trim(destinationHostname), trim(userAgent), trim(referer), trim(ipAddressShape) ], doubles: [ 1, bits, ipAddressVersion ], indexes: [ kind ] }; // version 1
        const makeEvent = (): AnalyticsEngineEvent => ({ blobs: [ 
            kind, colo, url, country, destinationHostname,
            userAgent, referer, errorsOrIpAddressShape, timeUuid, botType,
            hashedIpAddress, hashedIpAddressForDownload, audienceIdDownloadId, audienceIdDownloadId2, agentTypeAgentName,
            deviceTypeDeviceName, referrerTypeReferrerName, regionCodeRegionName, timezone, metroCode,
        ], doubles: [
            2, bits, ipAddressVersion, errorCount, asn,
            apVersion, cfVersion, dwVersion, ipAddressKnownCode,
        ], indexes: [ kind ] }); // version 2
        const rt = makeEvent();
        const size = computeBlobsSize(rt.blobs);
        if (size > MAX_BLOBS_SIZE) {
            const reclaim = size - MAX_BLOBS_SIZE;
            if (typeof referer === 'string' && typeof referrerTypeReferrerName === 'string') {
                const fromRef = Math.ceil(reclaim / 2);
                referer = referer.substring(0, referer.length - fromRef);
                referrerTypeReferrerName = referrerTypeReferrerName.substring(0, referrerTypeReferrerName.length - fromRef);
            }
            if (typeof userAgent === 'string' && typeof agentTypeAgentName === 'string') {
                const fromAgent = Math.ceil(reclaim / 2);
                userAgent = userAgent.substring(0, userAgent.length - fromAgent);
                agentTypeAgentName = agentTypeAgentName.substring(0, agentTypeAgentName.length - fromAgent);
            }
        }
        return makeEvent();
    } else if (kind === 'error-computing-trace-event') {
        const { error } = event;
        return { blobs: [ kind, trim(error) ], doubles: [ 1 ], indexes: [ kind ] };
    } else if (kind === 'worker-request') {
        const { colo, pathname, search = '', country, method, userAgent, contentType, millis, status, asn } = event;
        return { blobs: [ kind, colo, trim(pathname), country, method, trim(contentType), trim(search), trim(userAgent ?? '') ], doubles: [ 1, millis, status, asn ?? 0 ], indexes: [ kind ] };
    } else if (kind === 'do-fetch') {
        const { colo, durableObjectName, durableObjectClass, durableObjectId, isolateId, method, pathname } = event;
        return { blobs: [ kind, colo, durableObjectName, durableObjectClass, durableObjectId, isolateId, method, pathname ], doubles: [ 1 ], indexes: [ kind ] };
    } else if (kind === 'do-alarm') {
        const { colo, durableObjectName, durableObjectClass, durableObjectId, isolateId } = event;
        return { blobs: [ kind, colo, durableObjectName, durableObjectClass, durableObjectId, isolateId ], doubles: [ 1 ], indexes: [ kind ] };
    } else if (kind === 'console-info' || kind === 'console-warning' || kind === 'console-error') {
        const { spot, message } = event;
        const { colo = '', name = '', } = _workerInfo ?? {};
        return { blobs: [ kind, spot, trim(message), colo, name ], doubles: [ 1 ], indexes: [ kind ] };
    } else if (kind === 'admin-data-job') {
        const { colo, messageId, messageInstant, operationKind, targetPath, parameters, dryRun, millis, results, message } = event;
        const parametersStr = Object.entries((parameters ?? {})).map(v => v.join('=')).join(',');
        return {
            blobs: [ kind, colo, messageId, messageInstant, operationKind, trim(targetPath), trim(parametersStr), message ? trim(message) : null ],
            doubles: [ dryRun ? 1 : 0, millis, (results ?? []).length ],
            indexes: [ kind ]
        }
    } else if (kind === 'generic') {
        const { type, strings, doubles } = event;
        return { blobs: [ kind, type, ...(strings ?? []) ], doubles, indexes: [ kind ] };
    } else if (kind === 'storage-write') {
        const { durableObjectName, spot, alarms = 0 } = event;
        return { blobs: [ kind, durableObjectName, spot ], doubles: [ alarms ], indexes: [ kind ] };
    } else if (kind === 'hits-batch') {
        const { strings, doubles } = event;
        return { blobs: [ kind, ...strings ], doubles, indexes: [ kind ] };
    } else {
        throw new Error(`CloudflareTracer: Unsupported kind: ${kind}`);
    }
}

//

export type WorkerInfo = { readonly colo: string, name: string };

//

let _workerInfo: WorkerInfo | undefined;

function trim(str: string) {
    // sum of all blobs in a record must not exceed 5k
    return str.substring(0, 1024);
}
