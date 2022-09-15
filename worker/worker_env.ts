import { DurableObjectNamespace, AnalyticsEngine } from './deps.ts';

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
    readonly cfAnalyticsToken?: string;
}
