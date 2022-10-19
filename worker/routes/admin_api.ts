export function tryParseDurableObjectRequest(targetPath: string): string | undefined {
    const m = /^\/durable-objects\/([a-zA-Z0-9-]+)$/.exec(targetPath);
    return m ? m[1] : undefined;
}

export function checkDeleteDurableObjectAllowed(doName: string) {
    const allowed = doName.startsWith('request-');
    if (!allowed) throw new Error(`Not allowed to delete: ${doName}`);
}
