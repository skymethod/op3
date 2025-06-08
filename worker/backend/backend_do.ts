import { ManualColo } from './manual_colo.ts';
import { Bytes, DurableObjectState, DurableObjectStorage } from '../deps.ts';
import { checkDOInfo, DOInfo, isRpcRequest, isValidAlarmPayload, KeyKind, RpcClient, RpcResponse } from '../rpc_model.ts';
import { IsolateId } from '../isolate_id.ts';
import { WorkerEnv } from '../worker_env.ts';
import { RedirectLogController } from './redirect_log_controller.ts';
import { IpAddressEncryptionFn, IpAddressHashingFn } from './raw_redirects.ts';
import { KeyClient, KeyFetcher } from './key_client.ts';
import { KeyController } from './key_controller.ts';
import { encrypt, hmac, importAesKey, importHmacKey } from '../crypto.ts';
import { listRegistry, register } from './registry_controller.ts';
import { checkDeleteDurableObjectAllowed, tryParseDurableObjectRequest, tryParseRedirectLogRequest } from '../routes/admin_api.ts';
import { CloudflareRpcClient } from '../cloudflare_rpc_client.ts';
import { CombinedRedirectLogController } from './combined_redirect_log_controller.ts';
import { tryParseInt } from '../check.ts';
import { packHashedIpAddress } from '../ip_addresses.ts';
import { initCloudflareTracer, setWorkerInfo } from '../cloudflare_tracer.ts';
import { consoleError, consoleWarn, writeTraceEvent } from '../tracer.ts';
import { ApiAuthController } from './api_auth_controller.ts';
import { ShowController } from './show_controller.ts';
import { newPodcastIndexClient, tryPostDebug } from '../outbound.ts';
import { isValidOrigin } from '../check.ts';
import { R2BucketBlobs } from './r2_bucket_blobs.ts';
import { DoNames } from '../do_names.ts';
import { recomputeShowSummariesForMonth, tryParseRecomputeShowSummariesForMonthRequest } from './show_summaries.ts';
import { computeShowDailyDownloads, tryParseComputeShowDailyDownloadsRequest } from './downloads.ts';
import { computeQueryDownloadsResponse } from './query_downloads.ts';
import { HitsController } from './hits_controller.ts';

export class BackendDO {
    private readonly state: DurableObjectState;
    private readonly env: WorkerEnv;

    private info?: DOInfo;

    private redirectLogController?: RedirectLogController;
    private combinedRedirectLogController?: CombinedRedirectLogController;
    private keyClient?: KeyClient;

    private keyController?: KeyController;
    private apiAuthController?: ApiAuthController;
    private showController?: ShowController;
    private hitsController?: HitsController;

    constructor(state: DurableObjectState, env: WorkerEnv) {
        this.state = state;
        this.env = env;
        initCloudflareTracer(env.dataset1);
    }

    async fetch(request: Request): Promise<Response> {
        try {
            const isolateId = IsolateId.log();
            console.log(request.url);
            const colo = await ManualColo.get();
            const durableObjectName = request.headers.get('do-name');
            const durableObjectId = this.state.id.toString();
            const durableObjectClass = 'BackendDO';
            console.log('logprops:', { colo, durableObjectClass, durableObjectId, durableObjectName });

            setWorkerInfo({ colo, name: durableObjectName ?? '<unnamed>' });

            const { method } = request;
            const { pathname } = new URL(request.url);
            writeTraceEvent({ kind: 'do-fetch', colo, durableObjectClass, durableObjectId, durableObjectName: durableObjectName ?? '<unnamed>', isolateId, method, pathname });

            if (!durableObjectName) throw new Error(`Missing do-name header!`);
            const { backendNamespace, redirectLogNotificationDelaySeconds, deploySha, deployTime, origin, podcastIndexCredentials, blobsBucket, roBlobsBucket, queue2, instance, xfetcher } = this.env;
            if (!backendNamespace) throw new Error(`Missing backendNamespace!`);
            const rpcClient = new CloudflareRpcClient(backendNamespace, 3);
            const doInfo = await this.ensureInitialized({ colo, name: durableObjectName, rpcClient });

            if (method === 'POST' && pathname === '/rpc') {
                try {
                    const obj = await request.json();
                    if (!isRpcRequest(obj)) throw new Error(`Bad rpc request: ${JSON.stringify(obj)}`);
                    const { storage } = this.state;

                    const getOrLoadHashingFns = () => {
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
                        return { encryptIpAddress, hashIpAddress };
                    }

                    const getOrLoadRedirectLogController = () => {
                        if (this.redirectLogController) return this.redirectLogController;
                        const { encryptIpAddress, hashIpAddress } = getOrLoadHashingFns();
                        const notificationDelaySeconds = tryParseInt(redirectLogNotificationDelaySeconds);
                        this.redirectLogController = new RedirectLogController({ storage, colo, doName: durableObjectName, encryptIpAddress, hashIpAddress, notificationDelaySeconds, queue2 });
                        return this.redirectLogController;
                    }

                    const getOrLoadKeyController = () => {
                        if (!this.keyController) this.keyController = new KeyController(storage);
                        return this.keyController;
                    }

                    const getOrLoadCombinedRedirectLogController = () => {
                        if (this.combinedRedirectLogController) return this.combinedRedirectLogController;
                        const { hashIpAddress } = getOrLoadHashingFns();
                        this.combinedRedirectLogController = new CombinedRedirectLogController(storage, rpcClient, durableObjectName, hashIpAddress);
                        return this.combinedRedirectLogController;
                    }

                    const getOrLoadApiAuthController = () => {
                        if (!this.apiAuthController) this.apiAuthController = new ApiAuthController(storage);
                        return this.apiAuthController;
                    }

                    const getOrLoadShowController = () => {
                        if (!this.showController) {
                            if (typeof origin !== 'string') throw new Error(`'origin' is required to init ShowController`);
                            if (!isValidOrigin(origin)) throw new Error(`Valid 'origin' is required to init ShowController: ${JSON.stringify(origin)}`);
                            if (typeof podcastIndexCredentials !== 'string') throw new Error(`'podcastIndexCredentials' is required to init ShowController`);
                            const podcastIndexClient = newPodcastIndexClient({ podcastIndexCredentials, origin });
                            if (!podcastIndexClient) throw new Error(`Valid 'podcastIndexCredentials' are required to init ShowController`);
                            if (blobsBucket === undefined) throw new Error(`'blobsBucket' is required to init ShowController`);
                            const feedBlobs = new R2BucketBlobs({ bucket: blobsBucket, prefix: 'feed/' });
                            const statsBlobs = new R2BucketBlobs({ bucket: blobsBucket, prefix: 'stats/' });
                            const allowStorageImport = instance === 'ci'; // only allow show storage import on the CI instance, for testing
                            this.showController = new ShowController({ storage, durableObjectName, podcastIndexClient, origin, feedBlobs, statsBlobs, rpcClient, allowStorageImport, xfetcher });
                        }
                        return this.showController;
                    }

                    const getOrLoadHitsController = () => {
                        if (blobsBucket === undefined) throw new Error(`'blobsBucket' is required to init HitsController`);
                        const hitsBlobs = new R2BucketBlobs({ bucket: blobsBucket, prefix: 'hits/' });
                        const { encryptIpAddress, hashIpAddress } = getOrLoadHashingFns();
                        if (!this.hitsController) this.hitsController = new HitsController(storage, hitsBlobs, colo, rpcClient, durableObjectName, encryptIpAddress, hashIpAddress);
                        return this.hitsController;
                    }

                    if (obj.kind === 'log-raw-redirects') {
                        // save raw requests to storage
                        if (obj.saveForLater) {
                            await getOrLoadRedirectLogController().saveForLater(obj.rawRedirects);
                        } else {
                            await getOrLoadRedirectLogController().save(obj.rawRedirects);
                        }
                        return newRpcResponse({ kind: 'ok' });
                    } else if (obj.kind === 'get-new-redirect-logs') {
                        const { limit, startAfterTimestampId } = obj;
                        const { namesToNums, records } = await getOrLoadRedirectLogController().getNewRedirectLogs({ limit, startAfterTimestampId });
                        return newRpcResponse({ kind: 'packed-redirect-logs', namesToNums, records });
                    } else if (obj.kind === 'get-key') {
                        // get or generate key
                        const { keyKind, timestamp, id } = obj;
                        const {id: keyId, keyBytesBase64: rawKeyBase64 } = await getOrLoadKeyController().getOrGenerateKey(keyKind, timestamp, id);
                        return newRpcResponse({ kind: 'get-key', rawKeyBase64, keyId });
                    } else if (obj.kind === 'register-do') {
                        await register(obj.info, storage);
                        return newRpcResponse({ kind: 'ok' });
                    } else if (obj.kind === 'admin-data') {
                        const { operationKind, targetPath = '', parameters, dryRun = false } = obj;
                        if (operationKind === 'select' && targetPath === '/registry' && durableObjectName === DoNames.registry) {
                            return newRpcResponse({ kind: 'admin-data', results: await listRegistry(storage) });
                        } else if (operationKind === 'select' && targetPath === '/keys' && durableObjectName === DoNames.keyServer) {
                            return newRpcResponse({ kind: 'admin-data', results: await getOrLoadKeyController().listKeys() });
                        } else if (targetPath.startsWith('/crl/') && durableObjectName === DoNames.combinedRedirectLog) {
                            const backupBlobs = blobsBucket ? new R2BucketBlobs({ bucket: blobsBucket, prefix: 'backup/' }) : undefined;
                            const { results, message } = await getOrLoadCombinedRedirectLogController().adminExecuteDataQuery(obj, backupBlobs);
                            return newRpcResponse({ kind: 'admin-data', results, message });
                        } else if ((targetPath === '/api-keys' || targetPath.startsWith('/api-keys/')) && durableObjectName === DoNames.apiKeyServer) {
                            return newRpcResponse({ kind: 'admin-data', ...await getOrLoadApiAuthController().adminExecuteDataQuery(obj) });
                        } else if ((targetPath === '/feed-notifications' || targetPath.startsWith('/show/')) && durableObjectName === DoNames.showServer) {
                            const backupBlobs = blobsBucket ? new R2BucketBlobs({ bucket: blobsBucket, prefix: 'backup/' }) : undefined;
                            const hitsBlobs = blobsBucket ? new R2BucketBlobs({ bucket: blobsBucket, prefix: 'hits/' }) : undefined;
                            return newRpcResponse({ kind: 'admin-data', ...await getOrLoadShowController().adminExecuteDataQuery(obj, backupBlobs, hitsBlobs) });
                        } else if (targetPath.startsWith('/hits/') && durableObjectName === DoNames.hitsServer) {
                            const { results, message } = await getOrLoadHitsController().adminExecuteDataQuery(obj);
                            return newRpcResponse({ kind: 'admin-data', results, message });
                        } 

                        const csddr = tryParseComputeShowDailyDownloadsRequest({ operationKind, targetPath, parameters });
                        if (csddr) {
                            const statsBlobs = blobsBucket ? new R2BucketBlobs({ bucket: blobsBucket, prefix: 'stats/' }) : undefined;
                            if (statsBlobs === undefined) throw new Error(`computeShowDailyDownloads: statsBlobs is required`);
                            const result = await computeShowDailyDownloads(csddr, statsBlobs);
                            return newRpcResponse({ kind: 'admin-data', results: [ result ] });
                        }
                        
                        const rssfmr = tryParseRecomputeShowSummariesForMonthRequest({ operationKind, targetPath, parameters });
                        if (rssfmr) {
                            const statsBlobs = blobsBucket ? new R2BucketBlobs({ bucket: blobsBucket, prefix: 'stats/' }) : undefined;
                            if (statsBlobs === undefined) throw new Error(`recomputeShowSummariesForMonth: statsBlobs is required`);
                            const result = await recomputeShowSummariesForMonth(rssfmr, statsBlobs);
                            return newRpcResponse({ kind: 'admin-data', results: [ result ] });
                        }

                        const doName = tryParseDurableObjectRequest(targetPath);
                        if (doName) {
                            if (operationKind === 'delete') {
                                checkDeleteDurableObjectAllowed(targetPath);
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
                            } else if (operationKind === 'select') {
                                const ageInSeconds = IsolateId.ageInSeconds();
                                const { id, name, colo } = doInfo;
                                const state = this.combinedRedirectLogController ? await this.combinedRedirectLogController.getState() : undefined;
                                return newRpcResponse({ kind: 'admin-data', results: [ { id, name, colo, deploySha, deployTime, ageInSeconds, state } ] });
                            } else if (operationKind === 'update') {
                                if (this.combinedRedirectLogController) {
                                    const messages = await this.combinedRedirectLogController.updateState(parameters ?? {});
                                    return newRpcResponse({ kind: 'admin-data', results: messages });
                                }
                            }
                        }

                        const req = tryParseRedirectLogRequest(targetPath);
                        if (req && durableObjectName === DoNames.redirectLogForColo(req.colo)) {
                            return newRpcResponse({ kind: 'admin-data', ...await getOrLoadRedirectLogController().adminExecuteDataQuery(obj) });
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
                            const fromColo = await ManualColo.get();
                            await RedirectLogController.sendNotification(payload, { storage, rpcClient, fromColo });
                        } else if (alarmKind === CombinedRedirectLogController.processAlarmKind) {
                            await getOrLoadCombinedRedirectLogController().process();
                        } else if (alarmKind === ShowController.processAlarmKind && durableObjectName === DoNames.showServer) {
                            await getOrLoadShowController().work();
                        }
                        return newRpcResponse({ kind: 'ok' });
                    } else if (obj.kind === 'query-downloads') {
                        const statsBlobs = blobsBucket ? new R2BucketBlobs({ bucket: blobsBucket, prefix: 'stats/' }) : undefined;
                        const roStatsBlobs = roBlobsBucket ? new R2BucketBlobs({ bucket: roBlobsBucket, prefix: 'stats/', readonly: true }) : undefined;
                        return await computeQueryDownloadsResponse(obj, { statsBlobs, roStatsBlobs });
                    } else if (obj.kind === 'query-redirect-logs') {
                        return await getOrLoadCombinedRedirectLogController().queryRedirectLogs(obj);
                    } else if (obj.kind === 'admin-rebuild-index') {
                        const { first, last, count, millis } = await getOrLoadCombinedRedirectLogController().rebuildIndex(obj);
                        return newRpcResponse({ kind: 'admin-rebuild-index', first, last, count, millis });
                    } else if (obj.kind === 'admin-get-metrics') {
                        return getOrLoadHitsController().getMetrics();
                    } else if (obj.kind === 'resolve-api-token') {
                        return newRpcResponse(await getOrLoadApiAuthController().resolveApiToken(obj));
                    } else if (obj.kind === 'modify-api-key') {
                        return newRpcResponse(await getOrLoadApiAuthController().modifyApiKey(obj));
                    } else if (obj.kind === 'generate-new-api-key') {
                        return newRpcResponse(await getOrLoadApiAuthController().generateNewApiKey(obj));
                    } else if (obj.kind === 'get-api-key') {
                        return newRpcResponse(await getOrLoadApiAuthController().getApiKey(obj));
                    } else if (obj.kind === 'external-notification' && durableObjectName === DoNames.showServer) {
                        await getOrLoadShowController().receiveExternalNotification(obj);
                        return newRpcResponse({ kind: 'ok' });
                    } else if (obj.kind === 'query-packed-redirect-logs' && durableObjectName === DoNames.combinedRedirectLog) {
                        return newRpcResponse(await getOrLoadCombinedRedirectLogController().queryPackedRedirectLogs(obj));
                    } else if (obj.kind === 'log-raw-redirects-batch' && durableObjectName === DoNames.hitsServer) {
                        return newRpcResponse({ kind: 'log-raw-redirects-batch', ...await getOrLoadHitsController().logRawRedirectsBatch(obj) });
                    } else if (obj.kind === 'query-packed-redirect-logs' && durableObjectName === DoNames.hitsServer) {
                        return newRpcResponse(await getOrLoadHitsController().queryPackedRedirectLogs(obj));
                    } else if (obj.kind === 'query-hits-index' && durableObjectName === DoNames.hitsServer) {
                        return await getOrLoadHitsController().queryHitsIndex(obj);
                    } else {
                        throw new Error(`Unsupported rpc request: ${JSON.stringify(obj)}`);
                    }
                } catch (e) {
                    const message = `${(e as Error).stack || e}`;
                    consoleError('backend-do-rpc', `Unhandled error in rpc call: ${message}`);
                    return newRpcResponse({ kind: 'error', message });
                }
            }
            return new Response('not found', { status: 404 });
        } catch (e) {
            const msg = `Unhandled error in BackendDO.fetch: ${(e as Error).stack || e}`;
            consoleError('backend-do-fetch', msg);
            return new Response(msg, { status: 500 });
        }
    }

    async alarm() {
        let info: DOInfo | undefined;
        try {
            const { storage } = this.state;
            const payload = await storage.get('alarm.payload');
            console.log(`BackendDO.alarm: ${JSON.stringify(payload)}`);
            if (isValidAlarmPayload(payload)) {
                // workaround no logs for alarm handlers
                // make an rpc call back to this object
                const { backendNamespace } = this.env;
                const rpcClient = new CloudflareRpcClient(backendNamespace, 5); // alarm will retry for us, but we don't want to rely on that
                const fromIsolateId = IsolateId.get();
                info = this.info ?? await loadDOInfo(storage);
                if (!info) {
                    consoleError('backend-do-alarm-do-name', `BackendDO: unable to compute name!`);
                    return;
                }
                const { id: durableObjectId, name: durableObjectName, colo } = info;
                writeTraceEvent({ kind: 'do-alarm', colo, durableObjectClass: 'BackendDO', durableObjectId, durableObjectName: durableObjectName, isolateId: fromIsolateId });

                setWorkerInfo({ colo, name: durableObjectName ?? '<unnamed>' });
                
                await rpcClient.sendAlarm({ payload, fromIsolateId }, durableObjectName);
            }
        } catch (e) {
            const { debugWebhookUrl, origin, instance } = this.env;
            const durableObjectName = info?.name;
            if (debugWebhookUrl && origin) await tryPostDebug({ debugWebhookUrl, origin, instance, data: { kind: 'backend-do-alarm-unhandled', durableObjectName, error: `${(e as Error).stack || e}`} });
            consoleError('backend-do-alarm-unhandled', `BackendDO: Unhandled error in alarm: ${(e as Error).stack || e}`);
            throw e; // trigger a retry
        }
    }

    //
    
    private async ensureInitialized(opts: { colo: string, name: string, rpcClient: RpcClient }): Promise<DOInfo> {
        if (this.info) return this.info;

        const { storage } = this.state;
        const { colo, name, rpcClient } = opts;
        const time = new Date().toISOString();
        const id = this.state.id.toString();

        if (DoNames.isStorageless(name)) {
            this.info = { id, name, colo, firstSeen: time, lastSeen: time, changes: [] };
            return this.info;
        }

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
                await rpcClient.registerDO({ info }, DoNames.registry);
                console.log(`ensureInitialized: registered`);
            } catch (e) {
                consoleWarn('backend-do-register', `Error registering do: ${(e as Error).stack || e}`);
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
        const res = await rpcClient.getKey({ keyKind, timestamp, id }, DoNames.keyServer);
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
        consoleError('backend-do-loading-do-info', `Error loading do info: ${(e as Error).stack || e}`);
    }
    return undefined;
}

async function saveDOInfo(info: DOInfo, storage: DurableObjectStorage) {
    await storage.put('i.do', info);
}
