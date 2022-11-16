import { computeTimestamp, isValidTimestamp } from '../timestamp.ts';

export class TimestampSequence {

    private readonly extraDigits: number;
    private readonly maxExtra: number;

    private prevNow = 0;
    private prevTimestamp = '';
    private prevExtra = -1;

    constructor(extraDigits: number) {
        if (!Number.isInteger(extraDigits) || extraDigits < 0 || extraDigits > 4) throw new Error(`Bad extraDigits: ${extraDigits}`);
        this.extraDigits = extraDigits;
        this.maxExtra = Math.pow(10, extraDigits) - 1;
    }

    next(nowFn: () => number = Date.now): string {
        const now = nowFn();
        if (now > this.prevNow) {
            // easy case: advance ts, reset extra
            const timestamp = computeTimestamp(now);
            const extra = 0;
            this.prevNow = now;
            this.prevTimestamp = timestamp;
            this.prevExtra = extra;
            return timestamp + padExtra(extra, this.extraDigits);
        } else {
            // use prevNow as the base, advance extra
            if (this.prevNow <= 0 || this.prevTimestamp === '' || this.prevExtra < 0) throw new Error('Illegal state, bad time function?');
            let timestamp = this.prevTimestamp;
            let now = this.prevNow;
            let extra = this.prevExtra;
            if (this.extraDigits > 0) {
                extra++;
                if (extra > this.maxExtra) {
                    // out of extra, advance timestamp
                    now++;
                    timestamp = computeTimestamp(now);
                    extra = 0;
                }
            } else {
                // no extra digits, advance timestamp by one milli to avoid conflicts
                now++;
                timestamp = computeTimestamp(now);
            }
            this.prevNow = now;
            this.prevTimestamp = timestamp;
            this.prevExtra = extra;
            return timestamp + padExtra(extra, this.extraDigits);
        }
    }

}

export function unpackTimestampId(timestampId: string): { timestamp: string, extraDigits: string } {
    const timestamp = timestampId.substring(0, 15);
    if (!isValidTimestamp(timestamp)) throw new Error(`Bad timestampId: ${timestampId}`);
    const extraDigits = timestamp.substring(15);
    return { timestamp, extraDigits };
}

//

function padExtra(extra: number, extraDigits: number) {
    if (extra < 0) throw new Error(`Bad extra: ${extra}`);
    return extraDigits > 0 ? extra.toString().padStart(extraDigits, '0') : '';
}
