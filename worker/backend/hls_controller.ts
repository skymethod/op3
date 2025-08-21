import { computeChainDestinationUrl } from '../chain_estimate.ts';
import { isValidHttpUrl } from '../check.ts';
import { DurableObjectStorage, SqlStorage } from '../deps.ts';
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

        sql.exec(`create table if not exists record(uuid text primary key, atts text not null, sid text not null, time text not null, url text not null) without rowid`);
    }

    async sendPackedRecords(request: SendPackedRecordsRequest): Promise<void> {
        await Promise.resolve();
        const { storage, sql, origin } = this;
        const attNums = new AttNums(request.attNums);
        type Row = { uuid: string, atts: string, sid: string, time: string, url: string };
        const rows = new Map<string, Row>(); // by uuid
        for (const [ uuid, record ] of Object.entries(request.records)) {
            if (!isValidUuid(uuid)) throw new Error(`Bad uuid: ${uuid}`);
            const obj = attNums.unpackRecord(record);
            const { uuid: recordUuid, 'other.sid': sid, timestamp, url, ...rest } = obj; // TODO pull out other atts
            if (!isValidUuid(recordUuid)) throw new Error(`Bad recordUuid: ${recordUuid}`);
            if (uuid !== recordUuid) throw new Error(`Unexpected recordUuid: ${recordUuid}, expected ${uuid}`);
            if (!isValidUuid(sid)) throw new Error(`Bad sid: ${sid}`);
            if (!isValidTimestamp(timestamp)) throw new Error(`Bad timestamp: ${timestamp}`);
            const time = timestampToInstant(timestamp);
            if (!isValidHttpUrl(url)) throw new Error(`Bad url: ${url}`);
            const destinationUrl = computeChainDestinationUrl(url) ?? url;
            const prefixArgs = tryParsePrefixArguments(url, { origin });
            rows.set(uuid, { uuid, atts: JSON.stringify({ ...rest, prefixArgs }), sid, time, url: destinationUrl });
        }
        storage.transactionSync(() => {
            for (const { uuid, atts, sid, time, url } of rows.values()) {
                sql.exec('insert or ignore into record(uuid, atts, sid, time, url) values (?, ?, ?, ?, ?)', uuid, atts, sid, time, url);
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
