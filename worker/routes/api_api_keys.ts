import { DoNames } from '../do_names.ts';
import { newJsonResponse, newMethodNotAllowedResponse } from '../responses.ts';
import { isUnkindedModifyApiKeyRequest, RpcClient } from '../rpc_model.ts';
import { isValidUuid } from '../uuid.ts';
import { JsonProvider } from './api.ts';

export type ApiKeysRequestOpts = { instance: string, method: string, hostname: string, bodyProvider: JsonProvider, rawIpAddress: string | undefined, turnstileSecretKey: string | undefined, rpcClient: RpcClient };

export async function computeApiKeysResponse({ instance, method, hostname, bodyProvider, rawIpAddress, turnstileSecretKey, rpcClient }: ApiKeysRequestOpts): Promise<Response> {
    console.log('computeApiKeysResponse');
    const { turnstileToken, apiKey: apiKeyFromInput } = await commonRequest(instance, method, bodyProvider, rawIpAddress, turnstileSecretKey);
    if (typeof turnstileToken !== 'string') throw new Error(`Expected turnstileToken string`);
    if (apiKeyFromInput !== undefined && typeof apiKeyFromInput !== 'string') throw new Error(`Expected apiKeyFromInput string`);
    if (apiKeyFromInput !== undefined && !isValidUuid(apiKeyFromInput)) throw new Error(`Bad apiKeyFromInput`);

    await commonTurnstileValidation(hostname, turnstileSecretKey, turnstileToken, rawIpAddress!);

    // looks good, generate or lookup an api key
    const res = apiKeyFromInput ? await rpcClient.getApiKey({ apiKey: apiKeyFromInput }, DoNames.apiKeyServer) : await rpcClient.generateNewApiKey({ }, DoNames.apiKeyServer);
    const { info: { apiKey, status, created, permissions, shows, name, token, tokenLastUsed, blockReason } } = res;

    return newJsonResponse({ apiKey, status, created, permissions, shows, name, token, tokenLastUsed, blockReason });
}

export async function computeApiKeyResponse(apiKeyInput: string, isAdmin: boolean, { instance, method, hostname, bodyProvider, rawIpAddress, turnstileSecretKey, rpcClient }: ApiKeysRequestOpts): Promise<Response> {
    console.log('computeApiKeyResponse', { apiKeyInput, isAdmin });
    const req = await commonRequest(instance, method, bodyProvider, rawIpAddress, turnstileSecretKey);
    const { turnstileToken } = req;
    if (!isAdmin && typeof turnstileToken !== 'string') throw new Error(`Expected turnstileToken string`);
    if (!isUnkindedModifyApiKeyRequest(req)) throw new Error(`Expected ModifyApiKeyRequest`);
    if (apiKeyInput !== req.apiKey) throw new Error(`Bad apiKey: ${req.apiKey}`);

    if (!isAdmin) {
        await commonTurnstileValidation(hostname, turnstileSecretKey, turnstileToken, rawIpAddress!);
        // only allow certain modifications
        const allowed = (req.action === undefined || req.action === 'delete-token' || req.action === 'regenerate-token') && req.permissions === undefined;
        if (!allowed) throw new Error('Not allowed');
    }

    // looks good, modify the api key
    const { info: { apiKey, created, updated, name, permissions, shows, status, token, tokenLastUsed, blockReason } } = await rpcClient.modifyApiKey(req, DoNames.apiKeyServer);

    return newJsonResponse({ apiKey, created, updated, name, permissions, shows, status, token, tokenLastUsed, blockReason });
}

//

async function commonRequest(instance: string, method: string, bodyProvider: JsonProvider, rawIpAddress: string | undefined, turnstileSecretKey: string | undefined) {
    if (method !== 'POST') return newMethodNotAllowedResponse(method);
    if (typeof rawIpAddress !== 'string') throw new Error('Expected rawIpAddress string');
    if (instance !== 'local' && typeof turnstileSecretKey !== 'string') throw new Error('Expected turnstileSecretKey string');
    const requestBody = await bodyProvider();
    if (typeof requestBody !== 'object') throw new Error(`Expected object`);
    return requestBody;
}

async function commonTurnstileValidation(hostname: string, turnstileSecretKey: string | undefined, turnstileToken: string, rawIpAddress: string) {
    if (typeof turnstileSecretKey === 'string') { // everywhere except instance = local
        // validate the turnstile token
        const formData = new FormData();
        formData.append('secret', turnstileSecretKey);
        formData.append('response', turnstileToken);
        formData.append('remoteip', rawIpAddress);

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData } );
        if (res.status !== 200) throw new Error(`Unexpected status ${res.status}`);
        const obj = await res.json();
        console.log(JSON.stringify(obj, undefined, 2));
        const { success, hostname: responseHostname, challenge_ts, action } = obj;
        if (typeof success !== 'boolean' || typeof responseHostname !== 'string' || typeof challenge_ts !== 'string' || typeof action !== 'string') throw new Error(`Unexpected validation response`);
        if (responseHostname !== hostname) throw new Error(`Unexpected responseHostname`);
        if (action !== 'api-key') throw new Error(`Unexpected action`);
        const age = Date.now() - new Date(challenge_ts).getTime();
        console.log({ age });
        if (age > 1000 * 60 * 60) throw new Error(`Challenge age too old`);
        if (!success) throw new Error(`Validation failed`);
    }
}
