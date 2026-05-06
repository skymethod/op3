import { DurableObjectStorage, SqlStorage } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, ExecuteSqlRequest, ExecuteSqlResponse, RawRedirect, Unkinded } from '../rpc_model.ts';
import { computeTimestamp } from '../timestamp.ts';
import { computeIpAddressAttributes, IpAddressEncryptionFn, IpAddressHashingFn } from './raw_redirects.ts';
import { executeSqlCommon } from './sql_common.ts';

export class HlsInstanceController {

    private readonly storage: DurableObjectStorage;
    private readonly sql: SqlStorage;
    private readonly origin: string;
    private readonly encryptIpAddress: IpAddressEncryptionFn;
    private readonly hashIpAddress: IpAddressHashingFn;

    constructor({ storage, origin, encryptIpAddress, hashIpAddress }: { storage: DurableObjectStorage, origin: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn }) {
        this.storage = storage;
        const { sql } = storage;
        this.sql = sql;
        this.origin = origin;
        this.encryptIpAddress = encryptIpAddress;
        this.hashIpAddress = hashIpAddress;
        initSql(sql);
    }

    async process(rawRedirects: readonly RawRedirect[]): Promise<void> {
        await Promise.resolve();
        const { sql, encryptIpAddress, hashIpAddress } = this;

        for (const rawRedirect of rawRedirects) {
            const { uuid, time, rawIpAddress, method, url, userAgent, referer, range, ulid, xpsId, ipSource, other } = rawRedirect;
            const timestamp = computeTimestamp(time);
            const rt: Record<string, string> = {};
            await computeIpAddressAttributes(rt, rawIpAddress, timestamp, 'hls', encryptIpAddress, hashIpAddress);
            const { hashedIpAddress, hashedIpAddressForDownload } = rt;

            // TODO save
        }
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        await Promise.resolve();
        const { operationKind, targetPath, parameters } = req;

        // TODO if any
       
        throw new Error(`Unsupported hls query: ${JSON.stringify({ operationKind, targetPath, parameters })}`);
    }

    async executeSql(req: Unkinded<ExecuteSqlRequest>): Promise<Unkinded<ExecuteSqlResponse>> {
        return await executeSqlCommon(req, this.storage);
    }

}

// TODO

const REQUEST_COLUMNS = [
    // mandatory
    'uuid text primary key',
    'atts text not null',
    'method text not null',
    'url text not null',
    'sid text not null',
    'time text not null',
    'isolate_id text not null',

    // optional
    'pid text',
    'ppid text',
    'verified_time text',
    'hls_hash text',
    'hashed_ip_address text',
    'hashed_ip_address_for_download text',
    'user_agent text',
    'range_ text', // sqlite keyword
    'continent text',
    'country text',
    'region text',
    'colo text',
    'timezone text',
    'region_code text',
    'asn text',
    'subrequest text',
    'do_colo text',
    'hls_variant_hash text',
    'referer text',
    'xps_id text',
    'prefix_args text',
];

const REQUEST_COLUMN_NAMES = REQUEST_COLUMNS.map(v => v.split(' ')[0]);

function initSql(sql: SqlStorage) {
    // TODO
    // sql.exec(`create table if not exists request(${REQUEST_COLUMNS.join(', ')}) without rowid`);
}
