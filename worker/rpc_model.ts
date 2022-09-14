// deno-lint-ignore-file no-explicit-any

import { check, isStringRecord } from './check.ts';

export type RpcRequest = 
    LogRawRedirectsRequest 
    | GetKeyRequest
    | RegisterDORequest 
    | AdminDataRequest
    | RedirectLogsNotificationRequest
    | AlarmRequest
    | GetNewRedirectLogsRequest
    | QueryRedirectLogsRequest
    ;

export function isRpcRequest(obj: any): obj is RpcRequest {
    return isStringRecord(obj) && (
        obj.kind === 'log-raw-redirects' 
        || obj.kind === 'get-key' 
        || obj.kind === 'register-do' 
        || obj.kind === 'admin-data'
        || obj.kind === 'redirect-logs-notification'
        || obj.kind === 'alarm'
        || obj.kind === 'get-new-redirect-logs'
        || obj.kind === 'query-redirect-logs'
    );
}

export interface RawRedirect {
    readonly uuid: string;
    readonly time: number; // epoch millis
    readonly rawIpAddress: string;
    readonly method: string;
    readonly url: string;
    readonly userAgent?: string;
    readonly referer?: string;
    readonly range?: string;
    readonly ulid?: string;
    readonly other?: Readonly<Record<string, string>>;
}

export interface LogRawRedirectsRequest {
    readonly kind: 'log-raw-redirects';
    readonly rawRedirects: readonly RawRedirect[];
}

export type KeyKind = 'ip-address-hmac' | 'ip-address-aes';

export interface GetKeyRequest {
    readonly kind: 'get-key';
    readonly keyKind: KeyKind;
    readonly timestamp: string;
    readonly id?: string; // specific id if known
}

export interface RegisterDORequest {
    readonly kind: 'register-do';
    readonly info: DOInfo;
}

export interface DOInfo {
    readonly id: string;
    readonly name: string;
    readonly colo: string;
    readonly firstSeen: string; // instant
    readonly lastSeen: string; // instant
    readonly changes: readonly Change[]; // to id, name, colo
}

export function isValidDOInfo(obj: any): obj is DOInfo {
    try {
        checkDOInfo(obj);
        return true;
    } catch {
        return false;
    }
}

export function checkDOInfo(obj: any): obj is DOInfo {
    return isStringRecord(obj)
        && check('id', obj.id, v => typeof v === 'string')
        && check('name', obj.name, v => typeof v === 'string')
        && check('colo', obj.colo, v => typeof v === 'string')
        && check('firstSeen', obj.firstSeen, v => typeof v === 'string')
        && check('lastSeen', obj.lastSeen, v => typeof v === 'string')
        && check('changes', obj.changes, v => Array.isArray(v) && v.every(isValidChange))
        ;
}

export interface Change {
    readonly name: string;
    readonly value: string;
    readonly time: string; // instant
}

export function isValidChange(change: any): boolean {
    return isStringRecord(change)
        && typeof change.name === 'string'
        && typeof change.value === 'string'
        && typeof change.time === 'string'
        ;
}

export interface AdminDataRequest {
    readonly kind: 'admin-data';
    readonly operationKind: 'list' | 'delete';
    readonly targetPath: string;
    readonly dryRun?: boolean;
}

export interface RedirectLogsNotificationRequest {
    readonly kind: 'redirect-logs-notification';
    readonly doName: string;
    readonly timestampId: string;
    readonly fromColo: string;
}

export type AlarmPayload = Record<string, unknown> & { readonly kind: string };

export function isValidAlarmPayload(obj: any): obj is AlarmPayload {
    return isStringRecord(obj) && typeof obj.kind === 'string';
}

export interface AlarmRequest {
    readonly kind: 'alarm';
    readonly payload: AlarmPayload;
    readonly fromIsolateId: string;
}

export interface GetNewRedirectLogsRequest {
    readonly kind: 'get-new-redirect-logs';
    readonly limit: number;
    readonly startAfterTimestampId?: string;
}

export interface QueryRedirectLogsRequest {
    readonly kind: 'query-redirect-logs';

    readonly limit: number;
    readonly format?: string; // tsv, json-o, json-a

    readonly startTimeInclusive?: string; // instant
    readonly startTimeExclusive?: string; // instant
    readonly endTimeExclusive?: string; // instant

    readonly urlSha256?: string;
    readonly userAgent?: string;
    readonly referer?: string;
    readonly range?: string;
    readonly hashedIpAddress?: string;
    readonly edgeColo?: string;
    readonly doColo?: string;
    readonly source?: string;
    readonly ulid?: string;
    readonly method?: string;
    readonly uuid?: string;
}

//

export type RpcResponse = 
    OkResponse 
    | ErrorResponse 
    | GetKeyResponse 
    | AdminDataResponse
    | GetNewRedirectLogsResponse
    ;

export function isRpcResponse(obj: any): obj is RpcResponse {
    return typeof obj === 'object' && (
        obj.kind === 'ok' 
        || obj.kind === 'error' 
        || obj.kind === 'get-key'
        || obj.kind === 'admin-data'
        || obj.kind === 'get-new-redirect-logs'
    );
}

export interface OkResponse {
    readonly kind: 'ok';
}

export interface ErrorResponse {
    readonly kind: 'error';
    readonly message: string;
}

export interface GetKeyResponse {
    readonly kind: 'get-key';
    readonly keyId: string;
    readonly rawKeyBase64: string;
}

export interface AdminDataResponse {
    readonly kind: 'admin-data';
    readonly listResults?: unknown[];
    readonly message?: string;
}

export interface PackedRedirectLogs {
    readonly namesToNums: Record<string, number>;
    readonly records: Record<string, string>; // timestampId -> packed record
}

export interface GetNewRedirectLogsResponse extends PackedRedirectLogs {
    readonly kind: 'get-new-redirect-logs';
}

//

export type Unkinded<T extends RpcRequest> = Omit<T, 'kind'>;

export interface RpcClient {
    executeAdminDataQuery(request: Unkinded<AdminDataRequest>, target: string): Promise<AdminDataResponse>;
    registerDO(request: Unkinded<RegisterDORequest>, target: string): Promise<OkResponse>;
    getKey(request: Unkinded<GetKeyRequest>, target: string): Promise<GetKeyResponse>;
    sendRedirectLogsNotification(request: Unkinded<RedirectLogsNotificationRequest>, target: string): Promise<OkResponse>;
    logRawRedirects(request: Unkinded<LogRawRedirectsRequest>, target: string): Promise<OkResponse>;
    sendAlarm(request: Unkinded<AlarmRequest>, target: string): Promise<OkResponse>;
    getNewRedirectLogs(request: Unkinded<GetNewRedirectLogsRequest>, target: string): Promise<GetNewRedirectLogsResponse>;
    queryRedirectLogs(request: Unkinded<QueryRedirectLogsRequest>, target: string): Promise<Response>;
}
