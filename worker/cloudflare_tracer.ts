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

//

export type WorkerInfo = { readonly colo: string, name: string };

//

let _workerInfo: WorkerInfo | undefined;

function computeAnalyticsEngineEvent(event: TraceEvent): AnalyticsEngineEvent {
    const { kind } = event;
    if (kind === 'error-saving-redirect') {
        const { colo, error, country, uuids } = event;
        return { blobs: [ kind, colo, trim(error), country, trim(uuids.join(',')) ], doubles: [ 1 ], indexes: [ kind ] };
    } else if (kind === 'valid-redirect' || kind === 'invalid-redirect' || kind === 'banned-redirect') {
        const { colo, url, country, destinationHostname, userAgent, referer, hasForwarded, hasXForwardedFor, ipAddressShape, ipAddressVersion, errors, asn = 0, apVersion = 0, cfVersion = 0, dwVersion = 0, timeUuid = null, botType = null, hashedIpAddress = null, hashedIpAddressForDownload = null, 
            audienceIdDownloadId = null, audienceIdDownloadId2 = null, agentTypeAgentName = null } = event;
        const bits = (hasForwarded ? 1 : 0) | (hasXForwardedFor ? 2 : 0);
        const errorCount = errors.length;
        const errorsOrIpAddressShape = errorCount > 0 ? errors.join(',') : trim(ipAddressShape);
        // TODO disable v1 when v2 done
        if (kind !== undefined) return { blobs: [ kind, colo, trim(url), country, trim(destinationHostname), trim(userAgent), trim(referer), trim(ipAddressShape) ], doubles: [ 1, bits, ipAddressVersion ], indexes: [ kind ] }; // version 1
        return { blobs: [ 
            kind, colo, trim(url), country, trim(destinationHostname),
            trim(userAgent), trim(referer), errorsOrIpAddressShape, timeUuid, botType,
            hashedIpAddress, hashedIpAddressForDownload, audienceIdDownloadId, audienceIdDownloadId2, agentTypeAgentName,
        ], doubles: [
            2, bits, ipAddressVersion, errorCount, asn,
            apVersion, cfVersion, dwVersion,
        ], indexes: [ kind ] }; // version 2
    } else if (kind === 'error-computing-trace-event') {
        const { error } = event;
        return { blobs: [ kind, trim(error) ], doubles: [ 1 ], indexes: [ kind ] };
    } else if (kind === 'worker-request') {
        const { colo, pathname, search = '', country, method, contentType, millis, status } = event;
        return { blobs: [ kind, colo, trim(pathname), country, method, trim(contentType), trim(search) ], doubles: [ 1, millis, status ], indexes: [ kind ] };
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
    } else {
        throw new Error(`CloudflareTracer: Unsupported kind: ${kind}`);
    }
}

function trim(str: string) {
    // sum of all blobs in a record must not exceed 5k
    return str.substring(0, 1024);
}
