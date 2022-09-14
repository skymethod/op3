import { DurableObjectStorage } from '../deps.ts';
import { DOInfo, isValidDOInfo } from '../rpc_model.ts';

export async function register(info: DOInfo, storage: DurableObjectStorage) {
    await storage.put(`reg.id.${info.id}`, info);

    const objs = await listRegistry(storage);
    for (const obj of objs) {
        console.log(toShortString(obj));
    }
    console.log(`Total DOs registered: ${objs.length}`);
}

export async function listRegistry(storage: DurableObjectStorage): Promise<DOInfo[]> {
    const map = await storage.list({ prefix: 'reg.id.' });
    return [...map.values()].filter(isValidDOInfo);
}

//

function toShortString(info: DOInfo): string {
    const { id, name, colo, firstSeen, lastSeen, changes } = info;
    let rt = `${name} ${id} ${colo} [${firstSeen} to ${lastSeen}]`;
    const values: Record<string, string> = {};
    for (const change of changes) {
        const current = values[change.name];
        if (current) {
            rt += ` (${change.name}: ${current} -> ${change.value} at ${change.time})`;
        }
        values[change.name] = change.value;
    }
    return rt;
}
