// deno-lint-ignore-file no-explicit-any

import { RawRequest } from './raw_request.ts';
import { check, isStringRecord } from './check.ts';

export type RpcRequest = SaveRawRequestsRequest | GetKeyRequest | RegisterDORequest;

export function isRpcRequest(obj: any): obj is RpcRequest {
    return typeof obj === 'object' && (obj.kind === 'save-raw-requests' || obj.kind === 'get-key' || obj.kind === 'register-do');
}

export interface SaveRawRequestsRequest {
    readonly kind: 'save-raw-requests';
    readonly rawRequests: readonly RawRequest[];
}

export type KeyKind = 'ip-address-hmac' | 'ip-address-aes';

export interface GetKeyRequest {
    readonly kind: 'get-key';
    readonly keyKind: KeyKind;
    readonly keyScope: string; // e.g. 20220912
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

//

export type RpcResponse = OkResponse | ErrorResponse | GetKeyResponse;

export function isRpcResponse(obj: any): obj is RpcResponse {
    return typeof obj === 'object' && (obj.kind === 'ok' || obj.kind === 'error' || obj.kind === 'get-key');
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
    readonly rawKeyBase64: string;
}
