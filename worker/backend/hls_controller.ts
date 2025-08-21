import { computeChainDestinationUrl } from '../chain_estimate.ts';
import { isValidHttpUrl } from '../check.ts';
import { DurableObjectStorage, SqlStorage } from '../deps.ts';
import { unpackHashedIpAddressHash } from '../ip_addresses.ts';
import { AdminDataRequest, AdminDataResponse, SendPackedRecordsRequest, Unkinded } from '../rpc_model.ts';
import { timestampToInstant } from '../timestamp.ts';
import { isValidTimestamp } from '../timestamp.ts';
import { isValidUuid } from '../uuid.ts';
import { AttNums } from './att_nums.ts';
import { tryParsePrefixArguments } from './prefix_arguments.ts';

export class HlsController {

    private readonly storage: DurableObjectStorage;
    private readonly sql: SqlStorage;
    private readonly origin: string;

    constructor({ storage, origin }: { storage: DurableObjectStorage, origin: string }) {
        this.storage = storage;
        const { sql } = storage;
        this.sql = sql;
        this.origin = origin;

        sql.exec(`create table if not exists request(${REQUEST_COLUMNS.join(', ')}) without rowid`);
    }

    async sendPackedRecords(request: SendPackedRecordsRequest): Promise<void> {
        await Promise.resolve();
        const { storage, sql, origin } = this;
        const attNums = new AttNums(request.attNums);
        const rows = new Map<string, (string | undefined)[]>(); // binding values by uuid
        for (const [ uuid, record ] of Object.entries(request.records)) {
            if (!isValidUuid(uuid)) throw new Error(`Bad uuid: ${uuid}`);
            const obj = attNums.unpackRecord(record);
            const {
                // mandatory
                uuid: recordUuid,
                method,
                url,
                'other.sid': sid,
                timestamp,
                'other.isolateId': isolateId,
              
                // optional
                'other.pid': pid,
                'other.ppid': ppid,
                'other.hlsHash': hlsHash,
                encryptedIpAddress: _,
                hashedIpAddress: packedHashedIpAddress,
                hashedIpAddressForDownload: packedHashedIpAddressForDownload,
                userAgent, 
                range,
                'other.continent': continent,
                'other.country': country,
                'other.region': region,
                'other.colo': colo,
                'other.timezone': timezone,
                'other.regionCode': regionCode,
                'other.asn': asnStr,
                'other.subrequest': subrequest,
                doColo,
                ...rest
            } = obj;
            // mandatory
            if (!isValidUuid(recordUuid)) throw new Error(`Bad recordUuid: ${recordUuid}`);
            if (uuid !== recordUuid) throw new Error(`Unexpected recordUuid: ${recordUuid}, expected ${uuid}`);
            if (typeof method !== 'string') throw new Error(`Bad method: ${method}`);
            if (!isValidHttpUrl(url)) throw new Error(`Bad url: ${url}`);
            const destinationUrl = computeChainDestinationUrl(url) ?? url;
            if (!isValidUuid(sid)) throw new Error(`Bad sid: ${sid}`);
            if (!isValidTimestamp(timestamp)) throw new Error(`Bad timestamp: ${timestamp}`);
            const time = timestampToInstant(timestamp);
            if (typeof isolateId !== 'string') throw new Error(`Bad isolateId: ${isolateId}`);

            const hashedIpAddress = packedHashedIpAddress ? unpackHashedIpAddressHash(packedHashedIpAddress) : undefined;
            const hashedIpAddressForDownload = packedHashedIpAddressForDownload ? unpackHashedIpAddressHash(packedHashedIpAddressForDownload) : undefined;

            const prefixArgs = tryParsePrefixArguments(url, { origin });
            rows.set(uuid, [
                uuid,
                JSON.stringify({ ...rest, prefixArgs }),
                method,
                destinationUrl,
                sid,
                time,
                isolateId,

                pid,
                ppid,
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
                asnStr,
                subrequest,
                doColo,
            ]);
        }
        storage.transactionSync(() => {
            for (const bindings of rows.values()) {
                sql.exec(`insert or ignore into request(${REQUEST_COLUMN_NAMES.join(', ')}) values (${REQUEST_COLUMN_NAMES.map(_ => '?').join(', ')})`, ...bindings);
            }
        });
    }

    async adminExecuteDataQuery(req: Unkinded<AdminDataRequest>): Promise<Unkinded<AdminDataResponse>> {
        await Promise.resolve();
        const { sql } = this;
        const { operationKind, targetPath, parameters } = req;
        if (targetPath === '/hls/query') {
            if (operationKind === 'update') {
                const { q, ...rest } = parameters ?? {};
                if (typeof q !== 'string') throw new Error(`Param 'q' is required`);
                const params: unknown[] = [];
                for (let i = 1; i < 10; i++) {
                    const v = rest[`p${i}`];
                    if (typeof v !== 'string') break;
                    params.push(v);
                }
                const c = sql.exec(q, ...params);
                const { rowsRead, rowsWritten } = c;
                const results = c.toArray();
                const message = JSON.stringify({ rowsRead, rowsWritten });
                return { results, message };
            }
        }

        throw new Error(`Unsupported hls query: ${JSON.stringify({ operationKind, targetPath, parameters })}`);
    }

}

//

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
];

const REQUEST_COLUMN_NAMES = REQUEST_COLUMNS.map(v => v.split(' ')[0]);
