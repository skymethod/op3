import { encodeBase58 } from '../base58.ts';
import { isStringRecord } from '../check.ts';
import { DurableObjectStorageMethods, DurableObjectStorage, setEqual } from '../deps.ts';
import { ModifyApiKeyRequest, ApiKeyInfo, ApiKeyResponse, GenerateNewApiKeyRequest, GetApiKeyRequest, ResolveApiTokenRequest, ResolveApiTokenResponse, Unkinded, isApiKeyInfo, ApiTokenRecord, isApiTokenRecord, AdminDataRequest, AdminDataResponse } from '../rpc_model.ts';
import { addHours } from '../timestamp.ts';
import { consoleWarn } from '../tracer.ts';
import { generateUuid, isValidUuid } from '../uuid.ts';

export class ApiAuthController {

    private readonly storage: DurableObjectStorage;

    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
    }

    async resolveApiToken(request: Unkinded<ResolveApiTokenRequest>): Promise<ResolveApiTokenResponse> {
        const { token } = request;
        console.log(`ApiAuthController.resolveApiToken: ${JSON.stringify({ token })}`);
        return await this.storage.transaction(async tx => {
            const rec = await findApiTokenRecord(token, tx);
            if (!rec) return { 'kind': 'resolve-api-token', reason: 'invalid' };

            const { permissions, expires, blockReason } = rec;
            const now = new Date().toISOString();
            if (expires && now > expires) {
                console.log('Expired, delete token');
                await deleteApiTokenRecord(token, tx);
                return { 'kind': 'resolve-api-token', reason: 'expired' };
            }
            if (typeof blockReason === 'string') {
                console.log('Blocked!');
                return { 'kind': 'resolve-api-token', reason: 'blocked' };
            }

            const newRec: ApiTokenRecord = { ...rec, lastUsed: now };
            await saveApiTokenRecord(newRec, tx);
            return { 'kind': 'resolve-api-token', permissions };
        });
    }

    async modifyApiKey(request: Unkinded<ModifyApiKeyRequest>): Promise<ApiKeyResponse> {
        const { apiKey, permissions, name, action } = request;
        console.log(`ApiAuthController.modifyApiKey: ${JSON.stringify({ apiKey, permissions, name, action })}`);

        if (!isValidUuid(apiKey)) throw new Error(`Bad apiKey: ${apiKey}`);

        return await this.storage.transaction(async tx => {
            const record = await findApiKeyRecord(apiKey, tx);
            if (record === undefined) throw new Error(`Unable to find apiKey: ${apiKey}`);
    
            const now = new Date().toISOString();
            let keyRecord = record;
            const { status } = keyRecord;
            let tokenRecord = record.token ? await findApiTokenRecord(record.token, tx) : undefined;
            let includeTokenInResponse = false;
            if (permissions !== undefined) {
                // permission change
                if (status === 'blocked') throw new Error(`Cannot modify while blocked`);
                if (!same(permissions, record.permissions)) {
                    keyRecord = { ...keyRecord, permissions, updated: now };
                    await saveApiKeyRecord(keyRecord, tx);
                    if (tokenRecord) {
                        tokenRecord = { ...tokenRecord, permissions, updated: now };
                        await saveApiTokenRecord(tokenRecord, tx);
                    }
                }
            } else if (name !== undefined) {
                // name change
                if (status === 'blocked') throw new Error(`Cannot modify while blocked`);
                if (name !== keyRecord.name) {
                    keyRecord = { ...keyRecord, name, updated: now };
                    await saveApiKeyRecord(keyRecord, tx);
                }
            } else if (action !== undefined) {
                // action
                if (action === 'regenerate-token') {
                    if (status === 'blocked') throw new Error(`Cannot modify while blocked`);
                    const newToken = generateToken();
                    keyRecord = { ...keyRecord, token: newToken, status: 'active', updated: now };
                    await saveApiKeyRecord(keyRecord, tx);
                    if (tokenRecord) {
                        const expires = addHours(now, 2).toISOString();
                        const oldTokenRecord = { ...tokenRecord, updated: now, expires };
                        await saveApiTokenRecord(oldTokenRecord, tx);
                    }
                    tokenRecord = { token: newToken, apiKey, created: now, updated: now, permissions: keyRecord.permissions };
                    await saveApiTokenRecord(tokenRecord, tx);
                    includeTokenInResponse = true;
                } else if (action === 'delete-token') {
                    if (status === 'blocked') throw new Error(`Cannot modify while blocked`);
                    keyRecord = { ...keyRecord, token: undefined, status: 'inactive', updated: now };
                    await saveApiKeyRecord(keyRecord, tx);
                    if (tokenRecord) {
                        await deleteApiTokenRecord(tokenRecord.token, tx);
                        tokenRecord = undefined;
                    }
                } else if (action === 'unblock') {
                    if (status === 'blocked') {
                        keyRecord = { ...keyRecord, status: keyRecord.token ? 'active' : 'inactive', blockReason: undefined, updated: now };
                        await saveApiKeyRecord(keyRecord, tx);
                        if (tokenRecord && tokenRecord.blockReason !== undefined) {
                            tokenRecord = { ...tokenRecord, blockReason: undefined, updated: now };
                            await saveApiTokenRecord(tokenRecord, tx);
                        }
                    }
                } else if (isStringRecord(action) && action.kind === 'block') {
                    if (status !== 'blocked' || keyRecord.blockReason !== action.reason) {
                        keyRecord = { ...keyRecord, status: 'blocked', blockReason: action.reason, updated: now };
                        await saveApiKeyRecord(keyRecord, tx);
                        if (tokenRecord) {
                            tokenRecord = { ...tokenRecord, blockReason: action.reason, updated: now };
                            await saveApiTokenRecord(tokenRecord, tx);
                        }
                    }
                } else {
                    throw new Error(`Unsupported action: ${JSON.stringify(action)}`);
                }
            }
            const tokenLastUsed = tokenRecord?.lastUsed;
            const info: ApiKeyInfo = { ...keyRecord, token: includeTokenInResponse ? keyRecord.token : undefined, tokenLastUsed };
            return { kind: 'api-key', info };
        });
    }

    async generateNewApiKey(_request: Unkinded<GenerateNewApiKeyRequest>): Promise<ApiKeyResponse> {
        console.log(`ApiAuthController.generateNewApiKey`);

        const created = new Date().toISOString();
        const apiKey = generateUuid();

        const token = generateToken();

        const info: ApiKeyInfo = {
            apiKey,
            created,
            updated: created,
            permissions: [ 'read-data' ],
            status: 'active',
            name: 'my-new-key',
            token,
        };

        await this.storage.transaction(async tx => {
            await saveApiKeyRecord(info, tx);
            const tokenRecord: ApiTokenRecord = { token, apiKey, created, updated: created, permissions: info.permissions };
            await saveApiTokenRecord(tokenRecord, tx);
        });

        return { kind: 'api-key', info };
    }

    async getApiKey(request: Unkinded<GetApiKeyRequest>): Promise<ApiKeyResponse> {
        const { apiKey } = request;
        console.log(`ApiAuthController.getApiKey: ${JSON.stringify({ apiKey })}`);

        if (!isValidUuid(apiKey)) throw new Error(`Bad apiKey: ${apiKey}`);

        const record = await findApiKeyRecord(apiKey, this.storage);

        if (record === undefined) throw new Error(`Unable to find apiKey: ${apiKey}`);
        const tokenRecord = record.token ? await findApiTokenRecord(record.token, this.storage) : undefined;
        const tokenLastUsed = tokenRecord?.lastUsed;
        const info: ApiKeyInfo = { ...record, token: undefined, tokenLastUsed }; // don't return token

        return { kind: 'api-key', info };
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        const { operationKind, targetPath } = req;
        if (operationKind === 'select' && targetPath === '/api-keys') {
            const results: ApiKeyInfo[] = [];
            const map = await this.storage.list({ prefix: 'ak.1.'});
            for (const val of map.values()) {
                if (isApiKeyInfo(val)) {
                    results.push(val);
                }
            }
            return { results };
        }
        const m = /^\/api-keys\/info\/([^\/]+)$/.exec(targetPath); 
        if (m && operationKind === 'select') {
            const suffix = m[1];
            if (isValidUuid(suffix)) {
                const apiKey = suffix;
                const record = await findApiKeyRecord(apiKey, this.storage);
                if (record === undefined) throw new Error(`Unable to find apiKey: ${apiKey}`);
                const tokenRecord = record.token ? await findApiTokenRecord(record.token, this.storage) : undefined;
                return { results: [{ apiKeyInfo: record, apiTokenRecord: tokenRecord }] };
            } else {
                const apiToken = suffix;
                const tokenRecord = await findApiTokenRecord(apiToken, this.storage);
                if (tokenRecord === undefined) throw new Error(`Unable to find apiToken: ${apiToken}`);
                const record = await findApiKeyRecord(tokenRecord.apiKey, this.storage);
                if (record === undefined) throw new Error(`Unable to find apiKey: ${tokenRecord.apiKey}`);
                return { results: [{ apiKeyInfo: record, apiTokenRecord: tokenRecord }] };
            }
        }
        throw new Error(`Unsupported api-keys query`);
    }   

}

//

async function findApiKeyRecord(apiKey: string, storage: DurableObjectStorageMethods): Promise<ApiKeyInfo | undefined> {
    const rt = await storage.get(`ak.1.${apiKey}`);
    if (rt === undefined) return rt;
    if (!isApiKeyInfo(rt)) {
        consoleWarn('aac-bad-akr', `Bad storage value for apiKey: ${apiKey}`);
        return undefined;
    }
    return rt;
}

async function saveApiKeyRecord(record: ApiKeyInfo, storage: DurableObjectStorageMethods) {
    await storage.put(`ak.1.${record.apiKey}`, record);
}

async function findApiTokenRecord(token: string, storage: DurableObjectStorageMethods): Promise<ApiTokenRecord | undefined> {
    const rt = await storage.get(`at.1.${token}`);
    if (rt === undefined) return rt;
    if (!isApiTokenRecord(rt)) {
        consoleWarn('aac-bad-atr', `Bad storage value for apiToken: ${token}`);
        return undefined;
    }
    return rt;
}

async function saveApiTokenRecord(record: ApiTokenRecord, storage: DurableObjectStorageMethods) {
    await storage.put(`at.1.${record.token}`, record);
}

async function deleteApiTokenRecord(token: string, storage: DurableObjectStorageMethods) {
    await storage.delete(`at.1.${token}`);
}

function same<T>(lhs: readonly T[], rhs: readonly T[]): boolean {
    return setEqual(new Set(lhs), new Set(rhs));
}

function generateToken() {
    return encodeBase58(crypto.getRandomValues(new Uint8Array(32))); // 16 -> 22 chars, 32 -> 43 chars
}
