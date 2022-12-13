import { DurableObjectNamespace, AnalyticsEngine, R2Bucket, KVNamespace, Queue } from './deps.ts';

export interface WorkerEnv {
    readonly instance: string;
    readonly deployTime?: string;
    readonly deployRepositoryUrl?: string;
    readonly deploySha?: string;
    readonly deployFrom?: string;
    readonly backendNamespace: DurableObjectNamespace;
    readonly adminTokens?: string;
    readonly previewTokens?: string;
    readonly redirectLogNotificationDelaySeconds?: string;
    readonly dataset1?: AnalyticsEngine;
    readonly productionDomain?: string;
    readonly origin?: string;
    readonly cfAnalyticsToken?: string;
    readonly turnstileSitekey?: string;
    readonly turnstileSecretKey?: string;
    readonly podcastIndexCredentials?: string;
    readonly blobsBucket?: R2Bucket;
    readonly kvNamespace?: KVNamespace;
    readonly queue1?: Queue;
}
