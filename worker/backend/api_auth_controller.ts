import { encodeBase58 } from '../base58.ts';
import { DurableObjectStorage } from '../deps.ts';
import { ModifyApiKeyRequest, ApiKeyInfo, ApiKeyResponse, GenerateNewApiKeyRequest, GetApiKeyRequest, ResolveApiTokenRequest, ResolveApiTokenResponse, Unkinded } from '../rpc_model.ts';
import { generateUuid, isValidUuid } from '../uuid.ts';

export class ApiAuthController {

    private readonly storage: DurableObjectStorage;

    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
    }

    async resolveApiToken(request: Unkinded<ResolveApiTokenRequest>): Promise<ResolveApiTokenResponse> {
        const { token: _ } = request;
        // TODO lookup from storage
        await Promise.resolve();
        return { 'kind': 'resolve-api-token', reason: 'invalid' };
    }

    async modifyApiKey(request: Unkinded<ModifyApiKeyRequest>): Promise<ApiKeyResponse> {
        const { apiKey, permissions, name, action } = request;
        console.log(JSON.stringify({ apiKey, permissions, name, action }));
        // TODO modify in storage
        await Promise.resolve();
        throw new Error(`Api key not found: ${apiKey}`);
    }

    async generateNewApiKey(_request: Unkinded<GenerateNewApiKeyRequest>): Promise<ApiKeyResponse> {
        const created = new Date().toISOString();
        const apiKey = generateUuid();

        const token = encodeBase58(crypto.getRandomValues(new Uint8Array(32))); // 16 -> 22 chars, 32 -> 43 chars

        const info: ApiKeyInfo = {
            apiKey,
            created,
            updated: created,
            used: created,
            permissions: [ 'preview' ],
            status: 'active',
            name: 'my-new-key',
            token,
        };

        // TODO save in storage
        await Promise.resolve();

        return { kind: 'api-key', info };
    }

    async getApiKey(request: Unkinded<GetApiKeyRequest>): Promise<ApiKeyResponse> {
        const { apiKey } = request;
        if (!isValidUuid(apiKey)) throw new Error(`Bad apiKey: ${apiKey}`);

         // TODO find in storage
         await Promise.resolve();

        const created = new Date(Date.now() - 1000 * 60 * 5).toISOString();

        const info: ApiKeyInfo = {
            apiKey,
            created,
            updated: created,
            used: created,
            permissions: [ 'preview' ],
            status: 'active',
            name: 'my-new-key',
            // don't return token
        };

        return { kind: 'api-key', info };
    }

}
