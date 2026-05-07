import { computeChainDestinationUrl } from '../chain_estimate.ts';
import { isValidHttpUrl } from '../check.ts';
import { DurableObjectStorage, SqlStorage } from '../deps.ts';
import { AdminDataRequest, AdminDataResponse, ExecuteSqlRequest, ExecuteSqlResponse, RawRedirect, Unkinded } from '../rpc_model.ts';
import { computeTimestamp, isValidTimestamp, timestampToInstant } from '../timestamp.ts';
import { isValidUuid } from '../uuid.ts';
import { computeIpAddressAttributes, IpAddressEncryptionFn, IpAddressHashingFn } from './raw_redirects.ts';
import { executeSqlCommon } from './sql_common.ts';

export class HlsInstanceController {

    private readonly storage: DurableObjectStorage;
    private readonly sql: SqlStorage;
    private readonly origin: string;
    private readonly colo: string;
    private readonly encryptIpAddress: IpAddressEncryptionFn;
    private readonly hashIpAddress: IpAddressHashingFn;

    constructor({ storage, origin, colo, encryptIpAddress, hashIpAddress }: { storage: DurableObjectStorage, origin: string, colo: string, encryptIpAddress: IpAddressEncryptionFn, hashIpAddress: IpAddressHashingFn }) {
        this.storage = storage;
        const { sql } = storage;
        this.sql = sql;
        this.origin = origin;
        this.colo = colo;
        this.encryptIpAddress = encryptIpAddress;
        this.hashIpAddress = hashIpAddress;
        initSql(sql);
    }

    async process(rawRedirects: readonly RawRedirect[]): Promise<void> {
        const { storage, sql, encryptIpAddress, hashIpAddress, colo: doColo } = this;

        const requestRows = new Map<string, (string | undefined)[]>(); // binding values by uuid
        const pidHlsHashRows = new Map<string, (string | undefined)[]>(); // binding values by pid

        for (const rawRedirect of rawRedirects) {
            const { uuid, time, rawIpAddress, method, url, userAgent, referer, range, ulid, xpsId, ipSource, other = {} } = rawRedirect;
            const timestamp = computeTimestamp(time); // guarantees fixed length 24-char
            const rt: Record<string, string> = {};
            await computeIpAddressAttributes(rt, rawIpAddress, timestamp, 'hls', encryptIpAddress, hashIpAddress);
            const { hashedIpAddress, hashedIpAddressForDownload } = rt;

            const { sid, isolateId, pid, ppid, verifiedTimestamp, hlsHash, continent, country, region, colo, timezone, regionCode, metroCode, asn: asnStr, subrequest, ...rest } = other;
            if (!isValidUuid(sid)) throw new Error(`Bad sid: ${sid}`);
            if (typeof isolateId !== 'string') throw new Error(`Bad isolateId: ${isolateId}`);
            if (verifiedTimestamp !== undefined && !isValidTimestamp(verifiedTimestamp)) throw new Error(`Bad verifiedTimestamp: ${verifiedTimestamp}`);
            const verifiedTime = verifiedTimestamp !== undefined ? timestampToInstant(verifiedTimestamp) : undefined;

            if (typeof method !== 'string') throw new Error(`Bad method: ${method}`);
            if (!isValidHttpUrl(url)) throw new Error(`Bad url: ${url}`);
            const destinationUrl = computeChainDestinationUrl(url) ?? url;
            const atts = Object.keys(rest).length > 0 ? JSON.stringify(rest) : undefined;
            const errors = undefined;

            requestRows.set(uuid, [
                `${timestamp}_${uuid}`,
                method,
                destinationUrl,
                sid,
                isolateId,

                pid,
                ppid,
                verifiedTime,
                hlsHash,
                hashedIpAddress,

                hashedIpAddressForDownload,
                userAgent,
                range,
                continent,
                country,

                region,
                colo,
                timezone,
                regionCode,
                metroCode,

                asnStr,
                subrequest,
                doColo,
                referer,
                xpsId,

                ipSource,
                atts,
                errors,
            ]);

            if (typeof pid === 'string' && typeof hlsHash === 'string') {
                pidHlsHashRows.set(pid, [ pid, hlsHash ]);
            }
        }
        storage.transactionSync(() => {
            for (const bindings of requestRows.values()) {
                sql.exec(`insert or ignore into request(${REQUEST_COLUMN_NAMES.join(', ')}) values (${REQUEST_COLUMN_NAMES.map(v => v === 'atts' ? 'jsonb(?)' : '?').join(', ')})`, ...bindings);
            }
            for (const bindings of pidHlsHashRows.values()) {
                sql.exec(`insert or ignore into pid_hls_hash(pid, hls_hash) values (?, ?)`, ...bindings);
            }
        });
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        await Promise.resolve();
        const { origin, sql } = this;
        const { operationKind, targetPath, parameters } = req;

        if (targetPath === '/hlsi/init' && operationKind === 'update') {
            if (!origin.startsWith('https://ci.')) throw new Error(`Only allowed on ci!`);
            initSql(sql);
            return { message: 'init!' };
        }
       
        throw new Error(`Unsupported hls query: ${JSON.stringify({ operationKind, targetPath, parameters })}`);
    }

    async executeSql(req: Unkinded<ExecuteSqlRequest>): Promise<Unkinded<ExecuteSqlResponse>> {
        return await executeSqlCommon(req, this.storage);
    }

}

//

const REQUEST_COLUMNS = [
    // mandatory
    'time_uuid text primary key', // <fixed-width-24-char-timestamp>_<uuid> 
    'method text not null',
    'url text not null',
    'sid text not null',
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
    'metro_code text',

    'asn text',
    'subrequest text',
    'do_colo text',
    'referer text',
    'xps_id text',

    'ip_source text',
    'atts blob', // obj
    'errors blob', // string array
];

const REQUEST_COLUMN_NAMES = REQUEST_COLUMNS.map(v => v.split(' ')[0]);

function initSql(sql: SqlStorage) {
    sql.exec(`create table if not exists request(${REQUEST_COLUMNS.join(', ')}) without rowid`);
    sql.exec(`create table if not exists pid_hls_hash(pid text primary key, hls_hash text not null) without rowid`);
}
