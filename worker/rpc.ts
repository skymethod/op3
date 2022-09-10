import { RawRequest } from './raw_request.ts';

export type RpcRequest = SaveRawRequestsRequest;

// deno-lint-ignore no-explicit-any
export function isRpcRequest(obj: any): obj is RpcRequest {
    return typeof obj === 'object' && (obj.kind === 'save-raw-requests');
}

export interface SaveRawRequestsRequest {
    readonly kind: 'save-raw-requests';
    readonly rawRequests: readonly RawRequest[];
}

//

export type RpcResponse = OkResponse | ErrorResponse;

// deno-lint-ignore no-explicit-any
export function isRpcResponse(obj: any): obj is RpcResponse {
    return typeof obj === 'object' && (obj.kind === 'ok' || obj.kind === 'error');
}

export interface OkResponse {
    readonly kind: 'ok';
}

export interface ErrorResponse {
    readonly kind: 'error';
    readonly message: string;
}
