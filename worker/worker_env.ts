import { DurableObjectNamespace } from './deps.ts';

export interface WorkerEnv {
    readonly instance: string;
    readonly deployTime?: string;
    readonly deployRepositoryUrl?: string;
    readonly deploySha?: string;
    readonly deployFrom?: string;
    readonly backendNamespace: DurableObjectNamespace;
    readonly adminTokens?: string;
}
