export function getOrInit<K, V>(map: Map<K, V>, key: K, init: () => V): V {
    let rt = map.get(key);
    if (rt === undefined) {
        rt = init();
        map.set(key, rt);
    }
    return rt;
}
