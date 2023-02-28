export interface Configuration {
    get(name: string): Promise<string | undefined>;
    getObj(name: string): Promise<Record<string, unknown> | undefined>;
}
