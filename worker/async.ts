import { isStringRecord } from './check.ts';
import { increment } from './summaries.ts';

export async function timed<T>(work: () => Promise<T>): Promise<{ result: T, millis: number }>;
export async function timed<T>(times: Record<string, number>, key: string, work: () => Promise<T>): Promise<T>;
export async function timed<T>(timesOrWork: Record<string, number> | (() => Promise<T>), key?: string, work?: () => Promise<T>): Promise<T | { result: T, millis: number }> {
    if (typeof timesOrWork === 'function') {
        const start = Date.now();
        const result = await timesOrWork();
        return { result, millis: Date.now() - start };
    } else if (isStringRecord(timesOrWork) && key && work) {
        const times = timesOrWork;
        const start = Date.now();
        const result = await work();
        increment(times, key, Date.now() - start);
        return result;
    } else {
        throw new Error(`timed: Invalid arguments`);
    }
}
