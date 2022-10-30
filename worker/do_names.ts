export class DoNames {
    static readonly combinedRedirectLog = 'combined-redirect-log';
    static readonly showServer = 'show-server';
    static readonly registry = 'registry';
    static readonly keyServer = 'key-server';
    static readonly apiKeyServer = 'api-key-server';

    static readonly redirectLogForColo = (colo: string) => `redirect-log-${colo}`;
}
