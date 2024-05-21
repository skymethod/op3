import { Ratelimiter } from './deps.ts';

export interface Limiter {
    isAllowed(key: string): Promise<{ success: boolean }>;
}

export function makeCloudflareLimiter(limiter: Ratelimiter): Limiter {
    return {
        isAllowed: async key => {
            const { success } = await limiter.limit({ key });
            return { success };
        }
    }
}
