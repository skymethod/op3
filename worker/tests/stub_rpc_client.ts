// deno-lint-ignore-file no-unused-vars
import { AdminDataRequest, AdminDataResponse, AdminRebuildIndexRequest, AdminRebuildIndexResponse, AlarmRequest, GetKeyRequest, GetKeyResponse, GetMetricsRequest, GetNewRedirectLogsRequest, GetNewRedirectLogsResponse, LogRawRedirectsRequest, OkResponse, QueryRedirectLogsRequest, RedirectLogsNotificationRequest, RegisterDORequest, ResolveApiTokenRequest, ResolveApiTokenResponse, RpcClient, Unkinded } from '../rpc_model.ts';

export class StubRpcClient implements RpcClient {
    executeAdminDataQuery(request: Unkinded<AdminDataRequest>, target: string): Promise<AdminDataResponse> {
        throw new Error(`StubRpcClient: executeAdminDataQuery not implemented`);
    }

    adminRebuildIndex(request: Unkinded<AdminRebuildIndexRequest>, target: string): Promise<AdminRebuildIndexResponse> {
        throw new Error(`StubRpcClient: adminRebuildIndex not implemented`);
    }

    registerDO(request: Unkinded<RegisterDORequest>, target: string): Promise<OkResponse> {
        throw new Error(`StubRpcClient: registerDO not implemented`);
    }

    getKey(request: Unkinded<GetKeyRequest>, target: string): Promise<GetKeyResponse> {
        throw new Error(`StubRpcClient: getKey not implemented`);
    }

    sendRedirectLogsNotification(request: Unkinded<RedirectLogsNotificationRequest>, target: string): Promise<OkResponse> {
        throw new Error(`StubRpcClient: sendRedirectLogsNotification not implemented`);
    }

    logRawRedirects(request: Unkinded<LogRawRedirectsRequest>, target: string): Promise<OkResponse> {
        throw new Error(`StubRpcClient: logRawRedirects not implemented`);
    }

    sendAlarm(request: Unkinded<AlarmRequest>, target: string): Promise<OkResponse> {
        throw new Error(`StubRpcClient: sendAlarm not implemented`);
    }

    getNewRedirectLogs(request: Unkinded<GetNewRedirectLogsRequest>, target: string): Promise<GetNewRedirectLogsResponse> {
        throw new Error(`StubRpcClient: getNewRedirectLogs not implemented`);
    }

    queryRedirectLogs(request: Unkinded<QueryRedirectLogsRequest>, target: string): Promise<Response> {
        throw new Error(`StubRpcClient: queryRedirectLogs not implemented`);
    }

    getMetrics(request: Unkinded<GetMetricsRequest>, target: string): Promise<Response> {
        throw new Error(`StubRpcClient: getMetrics not implemented`);
    }

    resolveApiToken(request: Unkinded<ResolveApiTokenRequest>, target: string): Promise<ResolveApiTokenResponse> {
        throw new Error(`StubRpcClient: resolveApiToken not implemented`);
    }

}
