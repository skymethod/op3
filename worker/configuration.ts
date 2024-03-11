export interface Configuration {
    get(name: string): Promise<string | undefined>;
    getObj(name: string): Promise<Record<string, unknown> | undefined>;
}

export function makeCachedConfiguration(configuration: Configuration, millisToCache: (name: string) => number /*millis */): Configuration {
    const cache = new Map<string, { time: number, value: string | Record<string, unknown> | undefined }>();
    return {
        async get(name: string) {
            const cached = cache.get(name);
            if (cached) {
                const { time, value } = cached;
                const age = Date.now() - time;
                if (age < millisToCache(name)) return value as string | undefined;
            }
            const value = await configuration.get(name);
            cache.set(name, { time: Date.now(), value });
            return value;
        },
        async getObj(name: string) {
            const cached = cache.get(name);
            if (cached) {
                const { time, value } = cached;
                const age = Date.now() - time;
                if (age < millisToCache(name)) return value as Record<string, unknown> | undefined;
            }
            const value = await configuration.getObj(name);
            cache.set(name, { time: Date.now(), value });
            return value;
        },
    };
}
