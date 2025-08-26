// deno-lint-ignore-file no-explicit-any

import { check, isStringRecord } from './check.ts';
import { isValidUuid } from './uuid.ts';

export type RpcRequest = 
    | AdminDataRequest
    | AdminGetMetricsRequest
    | AdminRebuildIndexRequest
    | AlarmRequest
    | ExternalNotificationRequest
    | GenerateNewApiKeyRequest
    | GetApiKeyRequest
    | GetKeyRequest
    | GetNewRedirectLogsRequest
    | LogRawRedirectsRequest 
    | LogRawRedirectsBatchRequest 
    | ModifyApiKeyRequest
    | QueryPackedRedirectLogsRequest
    | QueryRedirectLogsRequest
    | QueryHitsIndexRequest
    | QueryDownloadsRequest
    | RedirectLogsNotificationRequest
    | RegisterDORequest 
    | ResolveApiTokenRequest
    | SendPackedRecordsRequest
    | ExecuteSqlRequest
    ;

export function isRpcRequest(obj: any): obj is RpcRequest {
    return isStringRecord(obj) && ( false
        || obj.kind === 'admin-data'
        || obj.kind === 'admin-get-metrics'
        || obj.kind === 'admin-rebuild-index'
        || obj.kind === 'alarm'
        || obj.kind === 'external-notification'
        || obj.kind === 'generate-new-api-key'
        || obj.kind === 'get-api-key'
        || obj.kind === 'get-key' 
        || obj.kind === 'get-new-redirect-logs'
        || obj.kind === 'log-raw-redirects' 
        || obj.kind === 'log-raw-redirects-batch' 
        || obj.kind === 'modify-api-key'
        || obj.kind === 'query-packed-redirect-logs'
        || obj.kind === 'query-redirect-logs'
        || obj.kind === 'query-hits-index'
        || obj.kind === 'query-downloads'
        || obj.kind === 'redirect-logs-notification'
        || obj.kind === 'register-do' 
        || obj.kind === 'resolve-api-token'
        || obj.kind === 'send-packed-records'
        || obj.kind === 'execute-sql'
    );
}

export interface RawRedirect {
    readonly uuid: string;
    readonly time: number; // epoch millis
    readonly rawIpAddress: string;
    readonly ipSource?: string; // e.g. x-forwarded-for
    readonly method: string;
    readonly url: string;
    readonly userAgent?: string;
    readonly referer?: string;
    readonly range?: string;
    readonly ulid?: string;
    readonly xpsId?: string;
    readonly other?: Readonly<Record<string, string>>;
}

export function isRawRedirect(obj: unknown): obj is RawRedirect {
    return isStringRecord(obj)
        && typeof obj.uuid === 'string'
        && typeof obj.time === 'number'
        && typeof obj.rawIpAddress === 'string'
        && (obj.ipSource === undefined || typeof obj.ipSource === 'string')
        && typeof obj.method === 'string'
        && typeof obj.url === 'string'
        && (obj.userAgent === undefined || typeof obj.userAgent === 'string')
        && (obj.referer === undefined || typeof obj.referer === 'string')
        && (obj.range === undefined || typeof obj.range === 'string')
        && (obj.ulid === undefined || typeof obj.ulid === 'string')
        && (obj.xpsId === undefined || typeof obj.xpsId === 'string')
        && (obj.other === undefined || isStringRecord(obj.other))
    ;
}

export interface LogRawRedirectsRequest {
    readonly kind: 'log-raw-redirects';
    readonly rawRedirects: readonly RawRedirect[];
    readonly saveForLater?: boolean;
}

export interface LogRawRedirectsBatchRequest {
    readonly kind: 'log-raw-redirects-batch';
    readonly rawRedirectsByMessageId: Record<string, { rawRedirects: RawRedirect[], timestamp: string }>;
    readonly rpcSentTime: string;
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
    readonly sql?: boolean;
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
        && check('sql', obj.sql, v => v === undefined || typeof v === 'boolean')
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
    readonly operationKind: 'select' | 'delete' | 'update';
    readonly targetPath: string;
    readonly parameters?: Record<string, string>;
    readonly dryRun?: boolean;
}

export interface AdminRebuildIndexRequest {
    readonly kind: 'admin-rebuild-index';
    readonly indexName: string;
    readonly start: string;
    readonly inclusive: boolean;
    readonly limit: number;
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

export interface QueryPackedRedirectLogsRequest {
    readonly kind: 'query-packed-redirect-logs';
    readonly limit: number;

    readonly startTimeInclusive?: string; // instant
    readonly startTimeExclusive?: string; // instant
    readonly endTimeExclusive?: string; // instant

    readonly startAfterRecordKey?: string; // from previous call
}

export interface QueryRedirectLogsRequest {
    readonly kind: 'query-redirect-logs';

    readonly limit: number;
    readonly format?: string; // tsv, json-o, json-a
    readonly include?: string;
    readonly descending?: boolean;

    readonly startTimeInclusive?: string; // instant
    readonly startTimeExclusive?: string; // instant
    readonly endTimeExclusive?: string; // instant

    readonly urlSha256?: string;
    readonly urlStartsWith?: string;
    readonly url?: string; // only supported by hits backend
    readonly userAgent?: string;
    readonly referer?: string;
    readonly hashedIpAddress?: string;
    readonly rawIpAddress?: string; // only allow caller ip
    readonly ulid?: string;
    readonly xpsId?: string;
}

export interface QueryHitsIndexRequest {
    readonly kind: 'query-hits-index';

    readonly limit: number;
    readonly descending?: boolean;

    readonly startTimeInclusive?: string; // instant
    readonly startTimeExclusive?: string; // instant
    readonly endTimeExclusive?: string; // instant

    readonly hashedIpAddress?: string;
    readonly rawIpAddress?: string; // only allow caller ip

    readonly url?: string;
    readonly urlStartsWith?: string;
}

export interface QueryDownloadsRequest {
    readonly kind: 'query-downloads';

    readonly limit: number;
    readonly format?: string; // tsv, json-o, json-a

    readonly startTimeInclusive?: string; // instant
    readonly startTimeExclusive?: string; // instant
    readonly endTimeExclusive?: string; // instant

    readonly continuationToken?: string;
    readonly skipHeaders?: boolean;

    readonly showUuid: string;
    readonly episodeId?: string;
    readonly bots?: 'include' | 'exclude';
    readonly ro?: boolean;
}

export interface AdminGetMetricsRequest {
    readonly kind: 'admin-get-metrics';
}

export interface ResolveApiTokenRequest {
    readonly kind: 'resolve-api-token';
    readonly token: string;
}

export interface ModifyApiKeyRequest {
    readonly kind: 'modify-api-key';
    readonly apiKey: string;
    readonly permissions?: readonly SettableApiTokenPermission[];
    readonly shows?: readonly string[];
    readonly name?: string;
    readonly action?: ModifyApiKeyAction;
}

export type ModifyApiKeyAction = 'delete-token' | 'regenerate-token' | { kind: 'block', reason: string } | 'unblock';

function isModifyApiKeyAction(obj: unknown): obj is ModifyApiKeyAction {
    return typeof obj === 'string' && [ 'delete-token', 'regenerate-token', 'unblock' ].includes(obj) 
        || isStringRecord(obj) && obj.kind === 'block' && typeof obj.reason === 'string';
}

export function isUnkindedModifyApiKeyRequest(obj: unknown): obj is Unkinded<ModifyApiKeyRequest> {
    return isStringRecord(obj)
    && typeof obj.apiKey === 'string'
    && (obj.permissions === undefined || Array.isArray(obj.permissions) && obj.permissions.every(isSettableApiTokenPermission))
    && (obj.shows === undefined || Array.isArray(obj.shows) && obj.shows.every(isValidUuid))
    && (obj.name === undefined || typeof obj.name === 'string')
    && (obj.action === undefined || isModifyApiKeyAction(obj.action));
}

export interface GenerateNewApiKeyRequest {
    readonly kind: 'generate-new-api-key';
}

export interface GetApiKeyRequest {
    readonly kind: 'get-api-key';
    readonly apiKey: string;
}

export interface ExternalNotificationRequest {
    readonly kind: 'external-notification';
    readonly notification: ExternalNotification;
    readonly received: string; // instant
}

export interface BaseExternalNotification extends Record<string, unknown> {
    readonly sent: string; // instant
    readonly sender: string;
}

export type ExternalNotification = FeedsExternalNotification | UrlsExternalNotification;

export interface FeedsExternalNotification extends BaseExternalNotification {
    readonly type: 'feeds';
    readonly feeds: readonly unknown[];
}

export interface UrlsExternalNotification extends BaseExternalNotification {
    readonly type: 'urls';
    readonly urls: readonly UrlInfo[];
}

export interface UrlInfo {
    readonly url: string;
    readonly found: string;
}

export function isUrlInfo(obj: unknown): obj is UrlInfo {
    return isStringRecord(obj)
        && typeof obj.url === 'string'
        && typeof obj.found === 'string'
        ;
}

export function isExternalNotification(obj: unknown): obj is ExternalNotification {
    return isStringRecord(obj)
        && (obj.type === 'feeds' || obj.type === 'urls')
        && typeof obj.sent === 'string'
        && typeof obj.sender === 'string'
        && (obj.type === 'feeds' && Array.isArray(obj.feeds) || obj.type === 'urls' && Array.isArray(obj.urls))
        ;
}

export interface SendPackedRecordsRequest {
    readonly kind: 'send-packed-records';
    readonly attNums: Record<string, number>;
    readonly records: Record<string, string>; // uuid -> record
}

export type SqlParam = string | number | boolean | null | undefined;

export type SqlStatement = { q: string, params?: SqlParam[] };

export interface ExecuteSqlRequest {
    readonly kind: 'execute-sql';
    readonly statements: SqlStatement[];
}

//

export type RpcResponse = 
    OkResponse 
    | ErrorResponse 
    | GetKeyResponse 
    | AdminDataResponse
    | AdminRebuildIndexResponse
    | PackedRedirectLogsResponse
    | ResolveApiTokenResponse
    | ApiKeyResponse
    | LogRawRedirectsBatchResponse
    | ExecuteSqlResponse
    ;

export function isRpcResponse(obj: any): obj is RpcResponse {
    return typeof obj === 'object' && (
        obj.kind === 'ok' 
        || obj.kind === 'error' 
        || obj.kind === 'get-key'
        || obj.kind === 'admin-data'
        || obj.kind === 'admin-rebuild-index'
        || obj.kind === 'packed-redirect-logs'
        || obj.kind === 'resolve-api-token'
        || obj.kind === 'api-key'
        || obj.kind === 'log-raw-redirects-batch'
        || obj.kind === 'execute-sql'
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
    readonly results?: unknown[];
    readonly message?: string;
}

export interface AdminRebuildIndexResponse {
    readonly kind: 'admin-rebuild-index';
    readonly first?: string;
    readonly last?: string;
    readonly count: number;
    readonly millis: number;
}

export interface PackedRedirectLogs {
    readonly namesToNums: Record<string, number>;
    readonly records: Record<string, string>; // timestampId -> packed record
}

export interface PackedRedirectLogsResponse extends PackedRedirectLogs {
    readonly kind: 'packed-redirect-logs';
}

export type SettableApiTokenPermission = 'preview' | 'read-data' | 'notification' | 'admin-metrics' | 'read-show';
export type ApiTokenPermission = 'admin' | SettableApiTokenPermission;

export function isSettableApiTokenPermission(value: string): value is SettableApiTokenPermission {
    return value === 'preview' || value === 'read-data' || value === 'notification' || value === 'admin-metrics' || value === 'read-show';
}

export function hasPermission(permissions: ReadonlySet<ApiTokenPermission>, ...allowablePermissions: ApiTokenPermission[]): boolean {
    return permissions.has('admin') || allowablePermissions.some(v => permissions.has(v));
}

export interface ResolveApiTokenResponse {
    readonly kind: 'resolve-api-token';
    readonly permissions?: readonly ApiTokenPermission[];
    readonly shows?: readonly string[];
    readonly reason?: 'invalid' | 'blocked' | 'expired';
}

export interface ApiKeyInfo {
    readonly apiKey: string;
    readonly created: string; // instant
    readonly updated: string; // instant
    readonly name: string; // user tag
    readonly permissions: readonly SettableApiTokenPermission[];
    readonly shows?: readonly string[];
    readonly status: 'active' | 'inactive' /* no token */ | 'blocked';
    readonly token?: string;
    readonly tokenLastUsed?: string;
    readonly blockReason?: string;
}

export function isApiKeyInfo(obj: unknown): obj is ApiKeyInfo {
    return isStringRecord(obj)
        && typeof obj.apiKey === 'string'
        && typeof obj.created === 'string'
        && typeof obj.updated === 'string'
        && typeof obj.name === 'string'
        && Array.isArray(obj.permissions) && obj.permissions.every(isSettableApiTokenPermission)
        && (obj.shows === undefined || Array.isArray(obj.shows) && obj.shows.every(isValidUuid))
        && typeof obj.status === 'string' && ['active', 'inactive', 'blocked'].includes(obj.status)
        && (obj.token === undefined || typeof obj.token === 'string')
        && (obj.tokenLastUsed === undefined || typeof obj.tokenLastUsed === 'string')
        && (obj.blockReason === undefined || typeof obj.blockReason === 'string')
        ;
}

export interface ApiKeyResponse {
    readonly kind: 'api-key';
    readonly info: ApiKeyInfo;
}

export interface ApiTokenRecord {
    readonly token: string;
    readonly apiKey: string;
    readonly created: string;
    readonly updated: string;
    readonly permissions: readonly SettableApiTokenPermission[];
    readonly shows?: readonly string[];
    readonly lastUsed?: string;
    readonly expires?: string; // instant
    readonly blockReason?: string; // if blocked
}

export function isApiTokenRecord(obj: unknown): obj is ApiTokenRecord {
    return isStringRecord(obj)
        && typeof obj.token === 'string'
        && typeof obj.apiKey === 'string'
        && typeof obj.created === 'string'
        && typeof obj.updated === 'string'
        && Array.isArray(obj.permissions) && obj.permissions.every(isSettableApiTokenPermission)
        && (obj.shows === undefined || Array.isArray(obj.shows) && obj.shows.every(isValidUuid))
        && (obj.lastUsed === undefined || typeof obj.lastUsed === 'string')
        && (obj.expires === undefined || typeof obj.expires === 'string')
        && (obj.blockReason === undefined || typeof obj.blockReason === 'string')
        ;
} 

export interface LogRawRedirectsBatchResponse {
    readonly kind: 'log-raw-redirects-batch';
    readonly processedMessageIds: readonly string[];
    readonly colo: string;
    readonly rpcSentTime: string;
    readonly rpcReceivedTime: string;
    readonly minTimestamp: string | undefined;
    readonly medTimestamp: string | undefined;
    readonly maxTimestamp: string | undefined;
    readonly messageCount: number;
    readonly redirectCount: number;
    readonly putCount: number;
    readonly evictedCount: number;
    readonly newUrlCount: number;
    readonly times: {
        readonly packRawRedirects: number,
        readonly saveAttNums: number,
        readonly ensureMinuteFileLoaded: number,
        readonly saveMinuteFile: number,
        readonly saveIndexRecords: number,
        readonly sendNotification: number,
        readonly sendPackedRecords: number,
    }
}

export interface SqlStatementResult {
    readonly rows: unknown[];
    readonly rowsRead: number;
    readonly rowsWritten: number;
}

export interface ExecuteSqlResponse {
    readonly kind: 'execute-sql';
    readonly results: SqlStatementResult[];
}

//

export type Unkinded<T extends RpcRequest | RpcResponse> = Omit<T, 'kind'>;

export interface RpcClient {
    registerDO(request: Unkinded<RegisterDORequest>, target: string): Promise<OkResponse>;
    getKey(request: Unkinded<GetKeyRequest>, target: string): Promise<GetKeyResponse>;
    sendRedirectLogsNotification(request: Unkinded<RedirectLogsNotificationRequest>, target: string): Promise<OkResponse>;
    logRawRedirects(request: Unkinded<LogRawRedirectsRequest>, target: string): Promise<OkResponse>;
    logRawRedirectsBatch(request: Unkinded<LogRawRedirectsBatchRequest>, target: string): Promise<LogRawRedirectsBatchResponse>;
    sendAlarm(request: Unkinded<AlarmRequest>, target: string): Promise<OkResponse>;
    getNewRedirectLogs(request: Unkinded<GetNewRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse>;
    queryPackedRedirectLogs(request: Unkinded<QueryPackedRedirectLogsRequest>, target: string): Promise<PackedRedirectLogsResponse>;
    queryRedirectLogs(request: Unkinded<QueryRedirectLogsRequest>, target: string): Promise<Response>;
    queryHitsIndex(request: Unkinded<QueryHitsIndexRequest>, target: string): Promise<Response>;
    queryDownloads(request: Unkinded<QueryDownloadsRequest>, target: string): Promise<Response>;
    resolveApiToken(request: Unkinded<ResolveApiTokenRequest>, target: string): Promise<ResolveApiTokenResponse>;
    generateNewApiKey(request: Unkinded<GenerateNewApiKeyRequest>, target: string): Promise<ApiKeyResponse>;
    getApiKey(request: Unkinded<GetApiKeyRequest>, target: string): Promise<ApiKeyResponse>;
    modifyApiKey(request: Unkinded<ModifyApiKeyRequest>, target: string): Promise<ApiKeyResponse>;
    receiveExternalNotification(request: Unkinded<ExternalNotificationRequest>, target: string): Promise<OkResponse>;
    sendPackedRecords(request: Unkinded<SendPackedRecordsRequest>, target: string, opts?: { sql?: boolean }): Promise<OkResponse>;
    executeSql(request: Unkinded<ExecuteSqlRequest>, target: string): Promise<ExecuteSqlResponse>;

    adminExecuteDataQuery(request: Unkinded<AdminDataRequest>, target: string, opts?: { sql?: boolean }): Promise<AdminDataResponse>;
    adminRebuildIndex(request: Unkinded<AdminRebuildIndexRequest>, target: string): Promise<AdminRebuildIndexResponse>;
    adminGetMetrics(request: Unkinded<AdminGetMetricsRequest>, target: string): Promise<Response>;
}
