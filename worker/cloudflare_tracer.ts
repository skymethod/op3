import { AnalyticsEngine, AnalyticsEngineEvent } from './deps.ts';
import { initTracer, TraceEvent } from './tracer.ts';

export function initCloudflareTracer(dataset: AnalyticsEngine | undefined) {
    if (!dataset) return;
    initTracer(event => {
        dataset.writeDataPoint(computeAnalyticsEngineEvent(event));
    });
}

//

function computeAnalyticsEngineEvent(event: TraceEvent): AnalyticsEngineEvent {
    const { kind } = event;
    if (kind === 'error-saving-redirect') {
        const { colo, error, country, uuids } = event;
        return { blobs: [ kind, colo, trim(error), country, trim(uuids.join(',')) ], doubles: [ 1 ] };
    } else if (kind === 'valid-redirect' || kind === 'invalid-redirect') {
        const { colo, url, country, destinationHostname } = event;
        return { blobs: [ kind, colo, trim(url), country, trim(destinationHostname) ], doubles: [ 1 ] };
    } else if (kind === 'error-computing-trace-event') {
        const { error } = event;
        return { blobs: [ kind, trim(error) ], doubles: [ 1 ] };
    } else if (kind === 'worker-request') {
        const { colo, pathname, country, method, contentType, millis, status } = event;
        return ({ blobs: [ kind, colo, trim(pathname), country, method, trim(contentType) ], doubles: [ 1, millis, status ] });
    } else if (kind === 'do-fetch') {
        const { colo, durableObjectName, durableObjectClass, durableObjectId, isolateId, method, pathname } = event;
        return ({ blobs: [ kind, colo, durableObjectName, durableObjectClass, durableObjectId, isolateId, method, pathname ], doubles: [ 1 ] });
    } else if (kind === 'do-alarm') {
        const { colo, durableObjectName, durableObjectClass, durableObjectId, isolateId } = event;
        return ({ blobs: [ kind, colo, durableObjectName, durableObjectClass, durableObjectId, isolateId ], doubles: [ 1 ] });
    } else if (kind === 'console-warning' || kind === 'console-error') {
        const { spot, message } = event;
        return ({ blobs: [ kind, spot, trim(message) ], doubles: [ 1 ] });
    } else {
        throw new Error(`CloudflareTracer: Unsupported kind: ${kind}`);
    }
}

function trim(str: string) {
    // sum of all blobs in a record must not exceed 5k
    return str.substring(0, 1024);
}
