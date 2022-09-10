export function isValidUuid(uuid: string) {
    return /^[0-9a-f]{32}$/.test(uuid);
}

export function generateUuid(): string {
    const rt = crypto.randomUUID().replaceAll('-', '').toLowerCase();
    if (!isValidUuid(rt)) throw new Error(`Bad uuid: ${rt}`);
    return rt;
}
