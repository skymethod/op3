export function splitArray<T>(arr: T[], n: number): T[][] {
    const rt = [];
    const partSize = Math.ceil(arr.length / n);

    for (let i = 0; i < n; i++) {
        rt.push(arr.slice(i * partSize, (i + 1) * partSize));
    }

    return rt;
}
