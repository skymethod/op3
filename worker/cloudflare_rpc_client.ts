import { DurableObjectNamespace } from './deps.ts';
import { AdminDataRequest, AdminDataResponse, AlarmRequest, GetKeyRequest, GetKeyResponse, GetNewRedirectLogsRequest, PackedRedirectLogsResponse, isRpcResponse, OkResponse, RedirectLogsNotificationRequest, RegisterDORequest, RpcClient, RpcRequest, LogRawRedirectsRequest, Unkinded, QueryRedirectLogsRequest, AdminRebuildIndexRequest, AdminRebuildIndexResponse, AdminGetMetricsRequest, ResolveApiTokenRequest, ResolveApiTokenResponse, ApiKeyResponse, GenerateNewApiKeyRequest, GetApiKeyRequest, ModifyApiKeyRequest, ExternalNotificationRequest, QueryPackedRedirectLogsRequest, QueryDownloadsRequest } from './rpc_model.ts';
import { executeWithRetries } from './sleep.ts';

export class CloudflareRpcClient implements RpcClient {
    private readonly backendNamespace: DurableObjectNamespace;
    private readonly maxRetries: number;

    constructor(backendNamespace: DurableObjectNamespace, maxRetries: number) {
        this.backendNamespace = backendNamespace;
        this.maxRetries = maxRetries;
    }

    async registerDO(request: Unkinded<RegisterDORequest>, target: string): Promise<OkResponse> {
        return await sendRpc<OkResponse>({ kind: 'register-do', ...request }, 'ok', this.computeOpts(target));
    }

    async getKey(request: Unkinded<GetKeyRequest>, target: string): Promise<GetKeyResponse> {
        return await sendRpc<GetKeyResponse>({ kind: 'get-key', ...request }, 'get-key', this.computeOpts(target));
    }

    async sendRedirectLogsNotification(request: Unkinded<RedirectLogsNotificationRequest>, target: string): Promise<OkResponse> {
        return await sendRpc<OkResponse>({ kind: 'redirect-logs-notification', ...request }, 'ok', this.computeOpts(target));
    }

    async logRawRedirects(request: Unkinded<LogRawRedirectsRequest>, target: string): Promise<OkResponse> {
        return await sendRpc<OkResponse>({ kind: 'log-raw-redirects', ...request }, 'ok', this.computeOpts(target));
    }

    async sendAlarm(request: Unkinded<AlarmRequest>, target: string): Promise<OkResponse> {
        return await sendRpc<OkResponse>({ kind: 'alarm', ...request }, 'ok', this.computeOpts(target));
    }

    async getNewRedirectLogs(request: Unkinded<GetNewRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse> {
        return await sendRpc<PackedRedirectLogsResponse>({ kind: 'get-new-redirect-logs', ...request }, 'packed-redirect-logs', this.computeOpts(target));
    }

    async queryPackedRedirectLogs(request: Unkinded<QueryPackedRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse> {
        return await sendRpc<PackedRedirectLogsResponse>({ kind: 'query-packed-redirect-logs', ...request }, 'packed-redirect-logs', this.computeOpts(target));
    }

    async queryRedirectLogs(request: Unkinded<QueryRedirectLogsRequest>, target: string): Promise<Response> {
        return await sendRpc<Response>({ kind: 'query-redirect-logs', ...request }, 'response', this.computeOpts(target));
    }

    async queryDownloads(request: Unkinded<QueryDownloadsRequest>, target: string): Promise<Response> {
        return await sendRpc<Response>({ kind: 'query-downloads', ...request }, 'response', this.computeOpts(target));
    }

    async resolveApiToken(request: Unkinded<ResolveApiTokenRequest>, target: string): Promise<ResolveApiTokenResponse> {
        return await sendRpc<ResolveApiTokenResponse>({ kind: 'resolve-api-token', ...request }, 'resolve-api-token', this.computeOpts(target));
    }

    async generateNewApiKey(request: Unkinded<GenerateNewApiKeyRequest>, target: string): Promise<ApiKeyResponse> {
        return await sendRpc<ApiKeyResponse>({ kind: 'generate-new-api-key', ...request }, 'api-key', this.computeOpts(target));
    }

    async getApiKey(request: Unkinded<GetApiKeyRequest>, target: string): Promise<ApiKeyResponse> {
        return await sendRpc<ApiKeyResponse>({ kind: 'get-api-key', ...request }, 'api-key', this.computeOpts(target));
    }

    async modifyApiKey(request: Unkinded<ModifyApiKeyRequest>, target: string): Promise<ApiKeyResponse> {
        return await sendRpc<ApiKeyResponse>({ kind: 'modify-api-key', ...request }, 'api-key', this.computeOpts(target));
    }

    async receiveExternalNotification(request: Unkinded<ExternalNotificationRequest>, target: string): Promise<OkResponse> {
        return await sendRpc<OkResponse>({ kind: 'external-notification', ...request }, 'ok', this.computeOpts(target));
    }

    //

    async adminExecuteDataQuery(request: Unkinded<AdminDataRequest>, target: string): Promise<AdminDataResponse> {
        return await sendRpc<AdminDataResponse>({ kind: 'admin-data', ...request }, 'admin-data', this.computeOpts(target));
    }

    async adminRebuildIndex(request: Unkinded<AdminRebuildIndexRequest>, target: string): Promise<AdminRebuildIndexResponse> {
        return await sendRpc<AdminRebuildIndexResponse>({ kind: 'admin-rebuild-index', ...request }, 'admin-rebuild-index', this.computeOpts(target));
    }

    async adminGetMetrics(request: Unkinded<AdminGetMetricsRequest>, target: string): Promise<Response> {
        return await sendRpc<Response>({ kind: 'admin-get-metrics', ...request }, 'response', this.computeOpts(target));
    }

    //

    private computeOpts(target: string): { doName: string, backendNamespace: DurableObjectNamespace, maxRetries: number } {
        const { backendNamespace, maxRetries } = this;
        return { doName: target, backendNamespace, maxRetries };
    }

}

//

async function sendRpc<T>(request: RpcRequest, expectedResponseKind: string, opts: { doName: string, backendNamespace: DurableObjectNamespace, maxRetries: number }): Promise<T> {
    const { maxRetries } = opts;
    return await executeWithRetries(() => sendSingleRpc(request, expectedResponseKind, opts), { tag: 'sendRpc', isRetryable, maxRetries });
}

async function sendSingleRpc(request: RpcRequest, expectedResponseKind: string, opts: { doName: string, backendNamespace: DurableObjectNamespace }) {
    const { doName, backendNamespace } = opts;

    const stub = backendNamespace.get(backendNamespace.idFromName(doName));
    const res = await stub.fetch('https://backend/rpc', { method: 'POST', body: JSON.stringify(request), headers: { 'do-name': doName } });

    if (res.status !== 200) throw new Error(`Bad rpc status: ${res.status}, body=${await res.text()}`);
    // deno-lint-ignore no-explicit-any
    if (expectedResponseKind === 'response') return res as any;
    const contentType = res.headers.get('content-type');
    if (contentType !== 'application/json') throw new Error(`Bad content-type: ${contentType}`);
    const obj = await res.json();
    if (!isRpcResponse(obj)) throw new Error(`Bad rpc response: ${JSON.stringify(obj)}`);
    if (obj.kind === 'error') throw new Error(`Rpc error: ${obj.message}`);
    if (obj.kind !== expectedResponseKind) throw new Error(`Unexpected rpc response: ${JSON.stringify(obj)}`);
    // deno-lint-ignore no-explicit-any
    return obj as any;
}

function isRetryable(e: Error): boolean {
    const error = `${e.stack || e}`;
    if (error.includes('Network connection lost')) return true; // Error: Network connection lost.
    if (error.includes('The Durable Object\'s code has been updated')) return true; // TypeError: The Durable Object's code has been updated, this version can no longer access storage.
    if (error.includes('Response closed due to connection limit')) return true; // Error: Response closed due to connection limit
    if (error.includes('Error: Durable Object reset because its code was updated')) return true; // Error: Rpc error: Error: Durable Object reset because its code was updated.
    if (error.includes('Internal error in Durable Object storage write')) return true; // Error: Internal error in Durable Object storage write caused object to be reset.
    if (error.includes('Durable Object storage operation exceeded timeout')) return true; // Error: Durable Object storage operation exceeded timeout which caused object to be reset.
    if (error.includes('Cannot resolve Durable Object due to transient')) return true; // Error: Cannot resolve Durable Object due to transient issue on remote node.
    if (error.includes('object has moved to a different machine')) return true; // Error: cannot access storage because object has moved to a different machine
    if (error.includes('Error: internal error')) return true; // Error: internal error
    if (error.includes('Error: Network connection lost')) return true; // Error: Network connection lost.
    return false;
}
