import { computeTimestamp, timestampToEpochMillis } from './timestamp.ts';
import { generateUuid } from './uuid.ts';

export class IsolateId {

    private static value: string | undefined;

    static get(): string {
        if (IsolateId.value === undefined) {
            IsolateId.value = `${computeTimestamp()}-${generateUuid()}`;
        }
        return IsolateId.value;
    }

    static ageInSeconds(): number {
        const time = timestampToEpochMillis(IsolateId.get().split('-')[0]);
        return (Date.now() - time) / 1000
    }

    static log(): string {
        const isolateId = IsolateId.get();
        console.log(`isolateId: ${isolateId} (${IsolateId.ageInSeconds()} seconds old)`);
        return isolateId;
    }
    
}
