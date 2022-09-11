import { isStringRecord } from './check.ts';
import { DurableObjectStorage } from './deps.ts';
import { DOInfo } from './rpc.ts';

export async function register(info: DOInfo, storage: DurableObjectStorage) {
    await storage.put(`reg.id.${info.id}`, info);

    const objs = await listRegistry(storage);
    console.log(`${objs.length} DOs registered:`);
    for (const obj of objs) {
        console.log(JSON.stringify(obj, undefined, 2));
    }
}

export async function listRegistry(storage: DurableObjectStorage): Promise<Record<string, unknown>[]> {
    const map = await storage.list({ prefix: 'reg.id.' });
    return [...map.values()].filter(isStringRecord);
}
