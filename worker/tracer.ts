export function initTracer(tracer: (event: TraceEvent) => void) {
    if (_tracer) return;
    _tracer = tracer;
}

export function writeTraceEvent(event: TraceEvent | (() => TraceEvent)) {
    if (!_tracer) return;
    let ev: TraceEvent;
    try {
        ev = typeof event === 'function' ? event() : event;
    } catch (e) {
        // tracing should never throw
        ev = { kind: 'error-computing-trace-event', error: `${e.stack || e}` };
    }
    try {
        _tracer(ev);
    } catch (e) {
        // tracing should never throw
        console.warn(`writeTraceEvent: Error writing ${ev.kind} event to tracer: ${e.stack || e}`);
    }
}

//

let _tracer: undefined | ((event: TraceEvent) => void) = undefined;

//

export type TraceEvent = 
    ErrorSavingRedirect
    | ValidRedirect
    | InvalidRedirect
    | ErrorComputingTraceEvent
    | WorkerRequest
    | DurableObjectFetchRequest
    | DurableObjectAlarmRequest
    ;

export interface ErrorSavingRedirect {
    readonly kind: 'error-saving-redirect',
    readonly colo: string;
    readonly error: string;
    readonly country: string;
    readonly uuids: readonly string[];
}

interface Redirect {
    readonly colo: string;
    readonly url: string;
    readonly country: string;
    readonly destinationHostname: string;
}

export interface ValidRedirect extends Redirect {
    readonly kind: 'valid-redirect',
}

export interface InvalidRedirect extends Redirect {
    readonly kind: 'invalid-redirect',
}

export interface ErrorComputingTraceEvent {
    readonly kind: 'error-computing-trace-event',
    readonly error: string;
}

export interface WorkerRequest {
    readonly kind: 'worker-request',
    readonly colo: string;
    readonly pathname: string;
    readonly country: string;
    readonly method: string;
    readonly millis: number;
    readonly status: number;
    readonly contentType: string;
}

export interface DurableObjectFetchRequest {
    readonly kind: 'do-fetch',
    readonly colo: string;
    readonly durableObjectName: string;
    readonly durableObjectId: string;
    readonly durableObjectClass: string;
    readonly isolateId: string;
    readonly method: string;
    readonly pathname: string;
}

export interface DurableObjectAlarmRequest {
    readonly kind: 'do-alarm',
    readonly colo: string;
    readonly durableObjectName: string;
    readonly durableObjectId: string;
    readonly durableObjectClass: string;
    readonly isolateId: string;
}
