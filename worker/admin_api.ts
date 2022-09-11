import { checkMatches } from './check.ts';

export function checkDeleteDurableObjectAllowed(targetPath: string): string {
    const [ _, doName ] = checkMatches('targetPath', targetPath, /^\/durable-object\/([a-zA-Z-]+)$/);
    const allowed = doName.startsWith('request-');
    if (!allowed) throw new Error(`Not allowed to delete: ${doName}`);
    return doName;
}
