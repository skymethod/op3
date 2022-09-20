import { BackendDOColo } from './backend_do_colo.ts';
import { Bytes, DurableObjectState, DurableObjectStorage } from '../deps.ts';
import { checkDOInfo, DOInfo, isRpcRequest, isValidAlarmPayload, KeyKind, RpcClient, RpcResponse } from '../rpc_model.ts';
import { IsolateId } from '../isolate_id.ts';
import { WorkerEnv } from '../worker_env.ts';
import { IpAddressEncryptionFn, IpAddressHashingFn, RedirectLogController } from './redirect_log_controller.ts';
import { KeyClient, KeyFetcher } from './key_client.ts';
import { KeyController } from './key_controller.ts';
import { encrypt, hmac, importAesKey, importHmacKey } from '../crypto.ts';
import { listRegistry, register } from './registry_controller.ts';
import { checkDeleteDurableObjectAllowed } from '../routes/admin_api.ts';
import { CloudflareRpcClient } from '../cloudflare_rpc_client.ts';
import { CombinedRedirectLogController } from './combined_redirect_log_controller.ts';
import { tryParseInt } from '../check.ts';
import { packHashedIpAddress } from '../ip_addresses.ts';

export class BackendDO {
    private readonly state: DurableObjectState;
    private readonly env: WorkerEnv;

    private info?: DOInfo;

    private redirectLogController?: RedirectLogController;
    private combinedRedirectLogController?: CombinedRedirectLogController;
    private keyClient?: KeyClient;

    private keyController?: KeyController;

    constructor(state: DurableObjectState, env: WorkerEnv) {
        this.state = state;
        this.env = env;
    }

    async fetch(request: Request): Promise<Response> {
        IsolateId.log();
        console.log(request.url);
        const colo = await BackendDOColo.get();
        const durableObjectName = request.headers.get('do-name');
        console.log('logprops:', { colo, durableObjectClass: 'BackendDO', durableObjectId: this.state.id.toString(), durableObjectName });

        try {
            if (!durableObjectName) throw new Error(`Missing do-name header!`);
            const { backendNamespace, redirectLogNotificationDelaySeconds } = this.env;
            if (!backendNamespace) throw new Error(`Missing backendNamespace!`);
            const rpcClient = new CloudflareRpcClient(backendNamespace);
            await this.ensureInitialized({ colo, name: durableObjectName, rpcClient });

            const { method } = request;
            const { pathname } = new URL(request.url);

            if (method === 'POST' && pathname === '/rpc') {
                try {
                    const obj = await request.json();
                    if (!isRpcRequest(obj)) throw new Error(`Bad rpc request: ${JSON.stringify(obj)}`);
                    const { storage } = this.state;

                    const getOrLoadRedirectLogController = () => {
                        if (this.redirectLogController) return this.redirectLogController;

                        if (!this.keyClient) this.keyClient = newKeyClient(rpcClient);
                        const keyClient = this.keyClient;
                        const encryptIpAddress: IpAddressEncryptionFn = async (rawIpAddress, opts) => {
                            const { id, key } = await keyClient.getKey('ip-address-aes', opts.timestamp);
                            const { encrypted, iv } = await encrypt(Bytes.ofUtf8(rawIpAddress), key);
                            return `2:${id}:${iv.hex()}:${encrypted.hex()}`;
                        }
                        const hashIpAddress: IpAddressHashingFn = async (rawIpAddress, opts) => {
                            const { id, key } = await keyClient.getKey('ip-address-hmac', opts.timestamp);
                            const signature = await hmac(Bytes.ofUtf8(rawIpAddress), key);
                            return packHashedIpAddress(id, signature);
                        }
                        const notificationDelaySeconds = tryParseInt(redirectLogNotificationDelaySeconds);
                        this.redirectLogController = new RedirectLogController({ storage, colo, doName: durableObjectName, encryptIpAddress, hashIpAddress, notificationDelaySeconds });
                        return this.redirectLogController;
                    }

                    const getOrLoadKeyController = () => {
                        if (!this.keyController) this.keyController = new KeyController(storage);
                        return this.keyController;
                    }

                    const getOrLoadCombinedRedirectLogController = () => {
                        if (!this.combinedRedirectLogController) this.combinedRedirectLogController = new CombinedRedirectLogController(storage, rpcClient);
                        return this.combinedRedirectLogController;
                    }

                    if (obj.kind === 'log-raw-redirects') {
                        // save raw requests to storage
                        await getOrLoadRedirectLogController().save(obj.rawRedirects);
                        return newRpcResponse({ kind: 'ok' });
                    } else if (obj.kind === 'get-new-redirect-logs') {
                        const { limit, startAfterTimestampId } = obj;
                        const { namesToNums, records } = await getOrLoadRedirectLogController().getNewRedirectLogs({ limit, startAfterTimestampId });
                        return newRpcResponse({ kind: 'get-new-redirect-logs', namesToNums, records });
                    } else if (obj.kind === 'get-key') {
                        // get or generate key
                        const { keyKind, timestamp, id } = obj;
                        const {id: keyId, keyBytesBase64: rawKeyBase64 } = await getOrLoadKeyController().getOrGenerateKey(keyKind, timestamp, id);
                        return newRpcResponse({ kind: 'get-key', rawKeyBase64, keyId });
                    } else if (obj.kind === 'register-do') {
                        await register(obj.info, storage);
                        return newRpcResponse({ kind: 'ok' });
                    } else if (obj.kind === 'admin-data') {
                        const { operationKind, targetPath, dryRun = false } = obj;
                        if (operationKind === 'list' && targetPath === '/registry' && durableObjectName === 'registry') {
                            return newRpcResponse({ kind: 'admin-data', listResults: await listRegistry(storage) });
                        } else if (operationKind === 'list' && targetPath === '/keys' && durableObjectName === 'key-server') {
                            return newRpcResponse({ kind: 'admin-data', listResults: await getOrLoadKeyController().listKeys() });
                        } else if (operationKind === 'list' && targetPath === '/crl/sources') {
                            return newRpcResponse({ kind: 'admin-data', listResults: await getOrLoadCombinedRedirectLogController().listSources() });
                        } else if (operationKind === 'list' && targetPath === '/crl/records') {
                            return newRpcResponse({ kind: 'admin-data', listResults: await getOrLoadCombinedRedirectLogController().listRecords() });
                        } else if (operationKind === 'delete' && targetPath.startsWith('/durable-object/')) {
                            const doName = checkDeleteDurableObjectAllowed(targetPath);
                            if (doName !== durableObjectName) throw new Error(`Not allowed to delete ${doName}: routed to ${durableObjectName}`);
                            let message = '';
                            if (dryRun) {
                                message = `DRY RUN: Would delete all storage for ${doName}`;
                            } else {
                                console.log(`Deleting all storage for ${doName}`);
                                const start = Date.now();
                                await storage.deleteAll();
                                message = `Deleted all storage for ${doName} in ${Date.now() - start}ms`;
                            }
                            console.log(message);
                            return newRpcResponse({ kind: 'admin-data', message });
                        }
                    } else if (obj.kind === 'redirect-logs-notification') {
                        console.log(`notification received: ${JSON.stringify(obj)}`);
                        const { doName, timestampId, fromColo } = obj;
                        await getOrLoadCombinedRedirectLogController().receiveNotification({ doName, timestampId, fromColo });
                        return newRpcResponse({ kind: 'ok' });
                    } else if (obj.kind === 'alarm') {
                        console.log(`alarm received: ${JSON.stringify(obj)}`);
                        const { payload } = obj;
                        const { kind: alarmKind } = payload;
                        if (alarmKind === RedirectLogController.notificationAlarmKind) {
                            const fromColo = await BackendDOColo.get();
                            await RedirectLogController.sendNotification(payload, { storage, rpcClient, fromColo });
                        } else if (alarmKind === CombinedRedirectLogController.processAlarmKind) {
                            await getOrLoadCombinedRedirectLogController().process();
                        }
                        return newRpcResponse({ kind: 'ok' });
                    } else if (obj.kind === 'query-redirect-logs') {
                        return await getOrLoadCombinedRedirectLogController().queryRedirectLogs(obj);
                    } else if (obj.kind === 'admin-rebuild-index') {
                        const { first, last, count, millis } = await getOrLoadCombinedRedirectLogController().rebuildIndex(obj);
                        return newRpcResponse({ kind: 'admin-rebuild-index', first, last, count, millis });
                    } else {
                        throw new Error(`Unsupported rpc request: ${JSON.stringify(obj)}`);
                    }
                } catch (e) {
                    const message = `${e.stack || e}`;
                    console.error(`Unhandled error in rpc call: ${message}`);
                    return newRpcResponse({ kind: 'error',  message });
                }
            }
            return new Response('not found', { status: 404 });
        } catch (e) {
            const msg = `Unhandled error in BackendDO.fetch: ${e.stack || e}`;
            console.error(msg);
            return new Response(msg, { status: 500 });
        }
    }

    async alarm() {
        const { storage } = this.state;
        const payload = await storage.get('alarm.payload');
        console.log(`BackendDO.alarm: ${JSON.stringify(payload)}`);
        if (isValidAlarmPayload(payload)) {
            // workaround no logs for alarm handlers
            // make an rpc call back to this object
            const { backendNamespace } = this.env;
            const rpcClient = new CloudflareRpcClient(backendNamespace);
            const fromIsolateId = IsolateId.get();
            const info = this.info ?? await loadDOInfo(storage);
            if (!info) {
                console.error(`BackendDO: unable to compute name!`);
                return;
            }
            await rpcClient.sendAlarm({ payload, fromIsolateId }, info.name);
        }
    }

    //
    
    private async ensureInitialized(opts: { colo: string, name: string, rpcClient: RpcClient }): Promise<DOInfo> {
        if (this.info) return this.info;

        const { storage } = this.state;
        const { colo, name, rpcClient } = opts;
        const time = new Date().toISOString();
        const id = this.state.id.toString();

        let info = await loadDOInfo(storage);
        if (info) {
            console.log(`ensureInitialized: updating`);
            if (info.id !== id) {
                info = { ...info, id, changes: [ ...info.changes, { name: 'id', value: id, time }] };
            }
            if (info.name !== name) {
                info = { ...info, name, changes: [ ...info.changes, { name: 'name', value: name, time }] };
            }
            if (info.colo !== colo) {
                info = { ...info, colo, changes: [ ...info.changes, { name: 'colo', value: colo, time }] };
            }
            info = { ...info, lastSeen: time };
        } else {
            console.log(`ensureInitialized: adding`);
            info = { id, name, colo, firstSeen: time, lastSeen: time, changes: [
                { name: 'id', value: id, time },
                { name: 'name', value: name, time },
                { name: 'colo', value: colo, time },
            ] };
        }
        await saveDOInfo(info, storage);
        this.info = info;

        // register!
        (async () => {
            try {
                console.log(`ensureInitialized: registering`);
                await rpcClient.registerDO({ info }, 'registry');
                console.log(`ensureInitialized: registered`);
            } catch (e) {
                console.error(`Error registering do: ${e.stack || e}`);
                // not the end of the world, info is saved, we'll try again next time
            }
        })()

        return info;
    }

}

//

function newKeyClient(rpcClient: RpcClient): KeyClient {
    const keyFetcher: KeyFetcher = async (keyKind: KeyKind, timestamp: string, id?: string) => {
        const importKey = keyKind === 'ip-address-hmac' ? importHmacKey : keyKind === 'ip-address-aes' ? importAesKey : undefined;
        if (!importKey) throw new Error(`Unsupported keyKind: ${keyKind}`);
        const res = await rpcClient.getKey({ keyKind, timestamp, id }, 'key-server');
        const key = await importKey(Bytes.ofBase64(res.rawKeyBase64));
        return { id: res.keyId, key };
    }
    return new KeyClient(keyFetcher);
}

function newRpcResponse(rpcResponse: RpcResponse): Response {
    return new Response(JSON.stringify(rpcResponse), { headers: { 'content-type': 'application/json' } });
}

async function loadDOInfo(storage: DurableObjectStorage): Promise<DOInfo | undefined> {
    const obj = await storage.get('i.do');
    try {
        if (checkDOInfo(obj)) return obj;
    } catch (e) {
        console.error(`Error loading do info: ${e.stack || e}`);
    }
    return undefined;
}

async function saveDOInfo(info: DOInfo, storage: DurableObjectStorage) {
    await storage.put('i.do', info);
}
