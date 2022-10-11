import { DurableObjectStorage } from '../deps.ts';
import { AdminModifyApiKeyRequest, ResolveApiTokenRequest, ResolveApiTokenResponse, Unkinded } from '../rpc_model.ts';

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

    async modifyApiKey(request: Unkinded<AdminModifyApiKeyRequest>): Promise<void> {
        const { apiKey: _, permissions: __ } = request;
        // TODO modify in storage
        await Promise.resolve();
    }

}
