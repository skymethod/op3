export interface Configuration {
    get(name: string): Promise<string | undefined>;
}
