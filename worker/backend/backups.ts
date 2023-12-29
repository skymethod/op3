import { Blobs, Multiput } from './blobs.ts';
import { DurableObjectStorage, DurableObjectStorageValue, concat } from '../deps.ts';
import { check, checkMatches, tryParseInt } from '../check.ts';
import { computeTimestamp } from '../timestamp.ts';
import { AdminDataResponse, Unkinded } from '../rpc_model.ts';

type Opts = { 
    operationKind: string, 
    parameters: Record<string, string>, 
    backupBlobs: Blobs | undefined, 
    isValidItem: (item: string) => boolean, 
    prefix: string, computeHeaderLine: () => string, 
    storage: DurableObjectStorage,
    computeKeyRange: (item: string) => { startKeyInclusive: string, endKeyExclusive: string },
    computeRecordLine: (key: string, record: DurableObjectStorageValue) => string,
};

export class Backups {
    private readonly backups: Backup[] = [];

    async execute({ operationKind, parameters, backupBlobs, isValidItem, prefix, computeHeaderLine, storage, computeRecordLine, computeKeyRange }: Opts): Promise<Unkinded<AdminDataResponse>>  {
        const { backups } = this;
        const backupToJson = (b: Backup) => ({ ...b, multiput: undefined, remainder: b.remainder?.length });
        if (operationKind === 'select') {
            return { results: backups.map(backupToJson) };
        }
        if (operationKind === 'update') {
            const { action = '', tag = '', item = '' } = parameters;
            checkMatches('action', action, /^(create|append|complete|abort)$/);
            checkMatches('tag', tag, /^[a-z0-9]+(-[a-z0-9]+)*$/);
            check('item', item, isValidItem);
            if (!backupBlobs) throw new Error(`backup: backupBlobs is required`);
            
            if (action === 'create') {
                const { partSizeMb: partSizeMbStr = '5' } = parameters; // 5mb = r2 minimum part size
                const partSizeMb = tryParseInt(partSizeMbStr);
                if (partSizeMb === undefined || partSizeMb < 5) throw new Error(`Bad partSizeMb: ${partSizeMb}`);
                if (backups.some(v => v.tag === tag && v.item === item)) throw new Error(`backup ${tag} ${item} already exists`);
                const created = new Date().toISOString();
                const timestamp = computeTimestamp(created);
                const multiput = await backupBlobs.startMultiput(`${prefix}${item}.${timestamp}.${tag}.txt`);
                const backup: Backup = { timestamp, tag, item, partSizeMb, records: 0, bytes: 0, partEtags: [ ], created, updated: created, multiput };
                backups.push(backup);
                return { results: [ backupToJson(backup) ]};
            }
            const backup = backups.find(v => v.tag === tag && v.item === item);
            if (!backup) throw new Error(`backup ${tag} ${item} not found`);
            const { multiput, partSizeMb } = backup;
            if (action === 'append') {
                const { limit: limitStr } = parameters;
                const limit = tryParseInt(limitStr);
                if (limit === undefined || limit < 1) throw new Error(`Bad limit: ${limitStr}`);

                const chunks: Uint8Array[] = [];
                let partSize = 0;
                let partRecords = 0;
                let partMaxKey = backup.maxKey;
                let lists = 0;
                let done = false;
                const encoder = new TextEncoder();
                if (backup.partEtags.length === 0) {
                    const chunk = encoder.encode(computeHeaderLine() + '\n');
                    chunks.push(chunk);
                    partSize += chunk.length;
                }
                if (backup.remainder) {
                    const chunk = backup.remainder;
                    chunks.push(chunk);
                    partSize += chunk.length;
                }
                const maxPartSize = 1024 * 1024 * partSizeMb;
                while (partSize < maxPartSize) { // common part size (for all but the last part)
                    const { startKeyInclusive, endKeyExclusive } = computeKeyRange(item);
                    const startOpts = partMaxKey ? { startAfter: partMaxKey } : { start: startKeyInclusive };
                    const map = await storage.list({ ...startOpts, end: endKeyExclusive, allowConcurrency: true, noCache: true, limit });
                    lists++;
                    if (map.size > 0) {
                        for (const [ key, record ] of map) {
                            const line = computeRecordLine(key, record);
                            const chunk = encoder.encode(line + '\n');
                            chunks.push(chunk);
                            partSize += chunk.length;
                            partMaxKey = partMaxKey === undefined || key > partMaxKey ? key : partMaxKey;
                            partRecords++;
                        }
                    }
                    if (map.size < limit) {
                        done = true;
                        break;
                    }
                }
                if (partSize > 0) {
                    let remainder: Uint8Array | undefined;
                    if (partSize > maxPartSize) {
                        // take remainder from chunks at the end
                        const remainderChunks: Uint8Array[] = [];
                        while (partSize > maxPartSize) {
                            const remainderSize = partSize - maxPartSize;
                            const lastIndex = chunks.length - 1;
                            const lastChunk = chunks[lastIndex];
                            if (remainderSize >= lastChunk.length) {
                                remainderChunks.unshift(lastChunk);
                                chunks.pop();
                                partSize -= lastChunk.length;
                            } else {
                                const keepSize = lastChunk.length - remainderSize;
                                remainderChunks.unshift(lastChunk.slice(keepSize));
                                chunks[lastIndex] = lastChunk.slice(0, keepSize);
                                partSize -= remainderSize;
                            }
                        }
                        remainder = concat(remainderChunks);
                        done = false;
                    }
                    const partBytes = concat(chunks);
                    if (partBytes.length !== partSize) throw new Error(`Unexpected partBytes: ${partBytes.length}, expected ${partSize}`);
                    const { etag } = await multiput.putPart(partBytes);
                    backup.bytes += partBytes.length;
                    backup.remainder = remainder;
                    backup.partEtags.push(etag);
                    backup.records += partRecords;
                    backup.updated = new Date().toISOString();
                    if (partMaxKey && (backup.maxKey === undefined || partMaxKey > backup.maxKey)) backup.maxKey = partMaxKey;
                }
                return { results: [ { ...backupToJson(backup), appended: partRecords, size: partSize, lists, done } ]};
            }
            if (action === 'complete') {
                const { parts, etag } = await multiput.complete();
                backup.updated = new Date().toISOString();
                backups.splice(backups.indexOf(backup), 1);
                return { results: [ { ...backupToJson(backup), completed: { parts, etag } } ]};
            }
            if (action === 'abort') {
                await multiput.abort();
                backup.updated = new Date().toISOString();
                backups.splice(backups.indexOf(backup), 1);
                return { results: [ { ...backupToJson(backup), aborted: true } ]};
            }
        }
        throw new Error(`Unsupported backup-related query`);
    }
}

type Backup = { timestamp: string, tag: string, item: string, partSizeMb: number, records: number, bytes: number, maxKey?: string, partEtags: string[], created: string, updated: string, multiput: Multiput, remainder?: Uint8Array };
