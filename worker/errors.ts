import { check, isStringRecord } from './check.ts';

export class StatusError extends Error {
    readonly status: number;
    
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }

}

export class CodedError extends Error implements ErrorInterface {
    readonly code: string;

    constructor(message: string, code: string, opts: ErrorOptions = {}) {
        super(message, opts);
        this.name = 'CodedError';
        this.code = code;
    }

    get cause(): ErrorInterface | undefined {
        return isErrorInterface(super.cause) ? super.cause : undefined;
    }
}

export interface ErrorInterface {
    readonly message: string;
    readonly stack?: string;
    readonly code?: string;
    readonly cause?: ErrorInterface;
}

export function checkErrorInterface(obj: unknown): obj is ErrorInterface {
    return isStringRecord(obj) 
        && check('message', obj.message, v => typeof v === 'string')
        && check('stack', obj.stack, v => v === undefined || typeof v === 'string')
        && check('code', obj.code, v => v === undefined || typeof v === 'string')
        && check('cause', obj.cause, v => v === undefined || checkErrorInterface(v))
        ;
}

export function isErrorInterface(obj: unknown): obj is ErrorInterface {
    return isStringRecord(obj)
        && typeof obj.message === 'string'
        && (obj.stack === undefined || typeof obj.stack === 'string')
        && (obj.code === undefined || typeof obj.code === 'string')
        && (obj.cause === undefined || isErrorInterface(obj.cause))
        ;
}

export function packError(e: unknown): ErrorInterface {
    if (e instanceof Error) {
        const { message, stack } = e;
        const code = e instanceof CodedError ? e.code : undefined;
        const cause = e.cause ? packError(e.cause) : undefined;
        return { message, stack, code, cause };
    }
    return { message: `Non-Error error: ${JSON.stringify(e)}` };
}

export function unpackError(e: ErrorInterface): Error {
    const { message: msg, code, stack } = e;
    const message = `${msg}${stack ? ` (original stack=${stack})` : ''}`;
    const cause = e.cause ? unpackError(e.cause) : undefined;
    return code ? new CodedError(message, code, { cause }): new Error(message, { cause });
}
