import { tryParseInt } from '../check.ts';

export class AttNums {

    private readonly namesToNums: Record<string, number> = {}; // attribute name -> unsigned int (starting at zero)
    private readonly numsToNames: Record<number, string> = {}; // reverse

    constructor(namesToNums: Record<string, number> = {}) {
        this.namesToNums = { ...namesToNums };
        for (const [ name, num ] of Object.entries(namesToNums)) {
            this.numsToNames[num] = name;
        }
    }

    isSubsetOf(other: AttNums): boolean {
        const otherJson = other.toJson();
        for (const [ name, num ] of Object.entries(this.namesToNums)) {
            if (otherJson[name] !== num) return false;
        }
        return true;
    }

    isSupersetOf(other: AttNums): boolean {
        const { namesToNums } = this;
        for (const [ name, num ] of Object.entries(other.toJson())) {
            if (namesToNums[name] !== num) return false;
        }
        return true;
    }

    find(name: string): number | undefined {
        return this.namesToNums[name];
    }

    get(name: string): number {
        let rt = this.namesToNums[name];
        if (typeof rt !== 'number') {
            const newNum = this.max() + 1;
            this.namesToNums[name] = newNum;
            this.numsToNames[newNum] = name;
            rt = newNum;
        }
        return rt;
    }

    max(): number {
        const nums = [...Object.values(this.namesToNums)];
        return nums.length === 0 ? -1 : Math.max(...nums);
    }

    toJson(): Record<string, number> {
        return { ...this.namesToNums };
    }

    // deno-lint-ignore no-explicit-any
    static fromJson(obj: any): AttNums {
        if (!obj || typeof obj !== 'object' || !Object.values(obj).every(v => typeof v === 'number' && Number.isInteger(v) && v >= 0)) throw new Error(`Bad attNums obj: ${JSON.stringify(obj)}`);
        return new AttNums(obj);
    }

    packRecord(record: Record<string, string>): string {
        const rt: string[] = [ ];
        for (const [ name, value ] of Object.entries(record)) {
            if (typeof name !== 'string' || typeof value !== 'string') throw new Error(`Bad record: ${JSON.stringify(record)}`);
            rt.push(`\t${this.get(name)}:${value.replaceAll('\t', '')}`)
        }
        if (rt.length === 0) return '';
        rt.push('\t');
        return rt.join('');
    }

    unpackRecord(record: string): Record<string, string> {
        if (typeof record !== 'string') throw new Error(`Bad record: ${record}`);
        const rt: Record<string, string> = {};
        if (record === '') return rt;
        const tokens = record.split('\t');
        if (tokens.length <= 2) throw new Error(`Bad record: ${record}`);
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (i === 0 || i === (tokens.length - 1)) {
                if (token !== '') throw new Error(`Bad record (bad end): ${record}`);
            } else {
                const colon = token.indexOf(':');
                if (colon < 0) throw new Error(`Bad record: ${record}`);
                const numStr = token.substring(0, colon);
                const num = tryParseInt(numStr);
                if (typeof num !== 'number') throw new Error(`Bad record (bad numStr ${numStr}): ${record}`);
                const name = this.numsToNames[num];
                if (name === undefined) throw new Error(`Bad record (bad num ${num}): ${record}`);
                rt[name] = token.substring(colon + 1);
            }
        }
        return rt;
    }

    removingPackedAtt(record: string, name: string): string {
        const num = this.find(name);
        if (num === undefined) return record;
        const start = record.indexOf(`\t${num}:`);
        if (start < 0) return record;
        const end = record.indexOf('\t', start + 1);
        return record.substring(0, start) + record.substring(end);
    }

}
