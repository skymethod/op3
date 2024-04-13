import { check, checkMatches, isNotBlank, isValidOrigin } from './check.ts';
import { LogRawRedirectsBatchRequest, LogRawRedirectsBatchResponse, QueryHitsIndexRequest } from './rpc_model.ts';
import { AdminDataRequest, AdminDataResponse, AdminGetMetricsRequest, AdminRebuildIndexRequest, AdminRebuildIndexResponse, AlarmRequest, ApiKeyResponse, ExternalNotificationRequest, GenerateNewApiKeyRequest, GetApiKeyRequest, GetColoStatusRequest, GetColoStatusResponse, GetKeyRequest, GetKeyResponse, GetNewRedirectLogsRequest, LogRawRedirectsRequest, ModifyApiKeyRequest, OkResponse, PackedRedirectLogsResponse, QueryDownloadsRequest, QueryPackedRedirectLogsRequest, QueryRedirectLogsRequest, RedirectLogsNotificationRequest, RegisterDORequest, ResolveApiTokenRequest, ResolveApiTokenResponse, RpcClient, RpcRequest, RpcResponse, Unkinded } from './rpc_model.ts';

export class StubRpcClient implements RpcClient {
    registerDO(request: Unkinded<RegisterDORequest>, target: string): Promise<OkResponse> {
        throw new Error(`StubRpcClient: registerDO(${JSON.stringify({ request, target })}) not implemented`);
    }

    getKey(request: Unkinded<GetKeyRequest>, target: string): Promise<GetKeyResponse> {
        throw new Error(`StubRpcClient: getKey(${JSON.stringify({ request, target })}) not implemented`);
    }

    sendRedirectLogsNotification(request: Unkinded<RedirectLogsNotificationRequest>, target: string): Promise<OkResponse> {
        throw new Error(`StubRpcClient: sendRedirectLogsNotification(${JSON.stringify({ request, target })}) not implemented`);
    }

    logRawRedirects(request: Unkinded<LogRawRedirectsRequest>, target: string): Promise<OkResponse> {
        throw new Error(`StubRpcClient: logRawRedirects(${JSON.stringify({ request, target })}) not implemented`);
    }

    logRawRedirectsBatch(request: Unkinded<LogRawRedirectsBatchRequest>, target: string): Promise<LogRawRedirectsBatchResponse> {
        throw new Error(`StubRpcClient: logRawRedirectsBatch(${JSON.stringify({ request, target })}) not implemented`);
    }

    sendAlarm(request: Unkinded<AlarmRequest>, target: string): Promise<OkResponse> {
        throw new Error(`StubRpcClient: sendAlarm(${JSON.stringify({ request, target })}) not implemented`);
    }

    getNewRedirectLogs(request: Unkinded<GetNewRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse> {
        throw new Error(`StubRpcClient: getNewRedirectLogs(${JSON.stringify({ request, target })}) not implemented`);
    }

    queryPackedRedirectLogs(request: Unkinded<QueryPackedRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse> {
        throw new Error(`StubRpcClient: queryPackedRedirectLogs(${JSON.stringify({ request, target })}) not implemented`);
    }

    queryRedirectLogs(request: Unkinded<QueryRedirectLogsRequest>, target: string): Promise<Response> {
        throw new Error(`StubRpcClient: queryRedirectLogs(${JSON.stringify({ request, target })}) not implemented`);
    }

    queryHitsIndex(request: Unkinded<QueryHitsIndexRequest>, target: string): Promise<Response> {
        throw new Error(`StubRpcClient: queryHitsIndex(${JSON.stringify({ request, target })}) not implemented`);
    }
    
    queryDownloads(request: Unkinded<QueryDownloadsRequest>, target: string): Promise<Response> {
        throw new Error(`StubRpcClient: queryDownloads(${JSON.stringify({ request, target })}) not implemented`);
    }

    resolveApiToken(request: Unkinded<ResolveApiTokenRequest>, target: string): Promise<ResolveApiTokenResponse> {
        throw new Error(`StubRpcClient: resolveApiToken(${JSON.stringify({ request, target })}) not implemented`);
    }

    generateNewApiKey(request: Unkinded<GenerateNewApiKeyRequest>, target: string): Promise<ApiKeyResponse> {
        throw new Error(`StubRpcClient: generateNewApiKey(${JSON.stringify({ request, target })}) not implemented`);
    }

    getApiKey(request: Unkinded<GetApiKeyRequest>, target: string): Promise<ApiKeyResponse> {
        throw new Error(`StubRpcClient: getApiKey(${JSON.stringify({ request, target })}) not implemented`);
    }

    modifyApiKey(request: Unkinded<ModifyApiKeyRequest>, target: string): Promise<ApiKeyResponse> {
        throw new Error(`StubRpcClient: modifyApiKey(${JSON.stringify({ request, target })}) not implemented`);
    }

    receiveExternalNotification(request: Unkinded<ExternalNotificationRequest>, target: string): Promise<OkResponse> {
        throw new Error(`StubRpcClient: receiveExternalNotification(${JSON.stringify({ request, target })}) not implemented`);
    }

    adminExecuteDataQuery(request: Unkinded<AdminDataRequest>, target: string): Promise<AdminDataResponse> {
        throw new Error(`StubRpcClient: adminExecuteDataQuery(${JSON.stringify({ request, target })}) not implemented`);
    }

    adminRebuildIndex(request: Unkinded<AdminRebuildIndexRequest>, target: string): Promise<AdminRebuildIndexResponse> {
        throw new Error(`StubRpcClient: adminRebuildIndex(${JSON.stringify({ request, target })}) not implemented`);
    }

    adminGetMetrics(request: Unkinded<AdminGetMetricsRequest>, target: string): Promise<Response> {
        throw new Error(`StubRpcClient: adminGetMetrics(${JSON.stringify({ request, target })}) not implemented`);
    }

    getColoStatus(request: Unkinded<GetColoStatusRequest>, target: string): Promise<GetColoStatusResponse> {
        throw new Error(`StubRpcClient: getColoStatus(${JSON.stringify({ request, target })}) not implemented`);
    }

}

export class ReadonlyRemoteDataRpcClient extends StubRpcClient {
    private readonly origin: string;
    private readonly token: string;

    constructor({ origin, token}: { origin: string, token: string }) {
        super();
        this.origin = origin;
        this.token = token;
    }

    static ofParams(params: string): RpcClient {
        const [ _, origin, token ] = checkMatches('params', params, /^(.*?),(.*?)$/);
        check('params', params, isValidOrigin(origin) && isNotBlank(token));
        return new ReadonlyRemoteDataRpcClient({ origin, token });
    }

    async adminExecuteDataQuery(request: Unkinded<AdminDataRequest>, _target: string): Promise<AdminDataResponse> {
        const { operationKind } = request;
        if (operationKind !== 'select') throw new Error(`ReadonlyRemoteDataRpcClient only permits 'select' operations`);
        const { origin, token } = this;
        const body = JSON.stringify(request);
        const url = `${origin}/api/1/admin/data`;
        const res = await fetch(url, { method: 'POST', body, headers: { authorization: `Bearer ${token}`} });
        if (res.status !== 200) {
            throw new Error(`ReadonlyRemoteDataRpcClient: Unexpected response status: ${res.status}, url=${url}, body=${await res.text()}`);
        }
        const rt = await res.json() as Unkinded<AdminDataResponse>;
        return { kind: 'admin-data', ...rt };
    }

    async queryHitsIndex(request: Unkinded<QueryHitsIndexRequest>, target: string): Promise<Response> {
        const { origin, token } = this;
        const url = `${origin}/api/1/admin/rpc`;
        const body = JSON.stringify({ request, target });
        const res = await fetch(url, { method: 'POST', body, headers: { authorization: `Bearer ${token}`} });
        if (res.status !== 200) {
            throw new Error(`ReadonlyRemoteDataRpcClient: Unexpected response status: ${res.status}, url=${url}, body=${await res.text()}`);
        }
        return res;
    }

}

export class RemoteRpcClient extends StubRpcClient {
    private readonly origin: string;
    private readonly token: string;

    constructor({ origin, token}: { origin: string, token: string }) {
        super();
        this.origin = origin;
        this.token = token;
    }

    async queryPackedRedirectLogs(request: Unkinded<QueryPackedRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse> {
        return await this.executeRpc({ kind: 'query-packed-redirect-logs', ...request }, target);
    }

    //
    
    private async executeRpc<TResponse extends RpcResponse>(request: RpcRequest, target: string): Promise<TResponse> {
        const res = await this.execute(request, target);
        return await res.json() as TResponse;
    }

    private async execute(request: RpcRequest, target: string): Promise<Response> {
        const { origin, token } = this;
        const url = `${origin}/api/1/admin/rpc`;
        const body = JSON.stringify({ request, target });
        const res = await fetch(url, { method: 'POST', body, headers: { authorization: `Bearer ${token}`} });
        if (res.status !== 200) {
            throw new Error(`RemoteRpcClient: Unexpected response status: ${res.status}, url=${url}, body=${await res.text()}`);
        }
        return res;
    }

}
