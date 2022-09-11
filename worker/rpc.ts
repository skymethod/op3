import { RawRequest } from './raw_request.ts';

export type RpcRequest = SaveRawRequestsRequest | GetKeyRequest;

// deno-lint-ignore no-explicit-any
export function isRpcRequest(obj: any): obj is RpcRequest {
    return typeof obj === 'object' && (obj.kind === 'save-raw-requests' || obj.kind === 'get-key');
}

export interface SaveRawRequestsRequest {
    readonly kind: 'save-raw-requests';
    readonly rawRequests: readonly RawRequest[];
}

export interface GetKeyRequest {
    readonly kind: 'get-key';
    readonly keyType: string; // e.g. ip-address-hmac
    readonly keyScope: string; // e.g. 20220912
}

//

export type RpcResponse = OkResponse | ErrorResponse | GetKeyResponse;

// deno-lint-ignore no-explicit-any
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
