import { DurableObjectStorage } from '../deps.ts';
import { ResolveApiTokenRequest, ResolveApiTokenResponse, Unkinded } from '../rpc_model.ts';

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

}
