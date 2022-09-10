export class AttNums {

    private readonly namesToNums: Record<string, number> = {}; // attribute name -> unsigned int (starting at zero)

    constructor(namesToNums: Record<string, number> = {}) {
        this.namesToNums = { ...namesToNums };
    }

    get(name: string): number {
        let rt = this.namesToNums[name];
        if (typeof rt !== 'number') {
            const newNum = this.max() + 1;
            this.namesToNums[name] = newNum;
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

}
