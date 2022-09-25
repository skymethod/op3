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
        return { blobs: [ kind, colo, error.substring(0, 1024), country, uuids.join(',').substring(0, 1024) ], doubles: [ 1 ] };
    } else if (kind === 'valid-redirect' || kind === 'invalid-redirect') {
        const { colo, url, country, destinationHostname } = event;
        return { blobs: [ kind, colo, url.substring(0, 1024), country, destinationHostname.substring(0, 1024) ], doubles: [ 1 ] };
    } else if (kind === 'error-computing-trace-event') {
        const { error } = event;
        return { blobs: [ kind, error.substring(0, 1024) ], doubles: [ 1 ] };
    } else if (kind === 'worker-request') {
        const { colo, pathname, country, method, contentType, millis, status } = event;
        return ({ blobs: [ kind, colo, pathname.substring(0, 1024), country, method, contentType.substring(0, 1024) ], doubles: [ 1, millis, status ] });
    } else {
        throw new Error(`CloudflareTracer: Unsupported kind: ${kind}`);
    }
}
