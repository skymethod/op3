import { checkMatches } from './check.ts';

export class DoNames {
    static readonly combinedRedirectLog = 'combined-redirect-log';
    static readonly showServer = 'show-server';
    static readonly registry = 'registry';
    static readonly keyServer = 'key-server';
    static readonly apiKeyServer = 'api-key-server';
    static readonly hitsServer = 'hits-server';
    static readonly hlsServer = 'hls-server';

    static readonly redirectLogForColo = (colo: string) => `redirect-log-${colo}`;

    static readonly storagelessForSuffix = (suffix: string) => {
        checkMatches('suffix', suffix, /^[a-z0-9]+(-[a-z0-9]+)*$/);
        return `storageless-${suffix}`;
    }

    static readonly isStorageless = (name: string) => name.startsWith('storageless-');
}
