export function shuffleArray<T>(arr: readonly T[]): T[] {
    const length = arr.length;
    const rt = [...arr];

    for (let i = 0; i <= length - 2; i++) {
        const rand = i + Math.floor(Math.random() * (length - i));
        const tmp = rt[rand];
        rt[rand] = rt[i];
        rt[i] = tmp;
    }

    return rt;
}
