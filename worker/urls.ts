

export function tryCleanUrl(url: string): string | undefined {
    try {
        return cleanUrl(url);
    } catch {
        // noop
    }
}

export function cleanUrl(url: string): string {
    if (typeof url !== 'string') throw new Error(`Bad url: ${JSON.stringify(url)}`);
    // only basic canonicalization like scheme, hostname, redundant port, anchor removal
    const m = /^(https?):\/\/([^\/:?#]+)(:\d+)?(\/.*?)?(#.*?)?$/i.exec(url.trim());
    if (!m) throw new Error(`Bad url: ${url}`);
    const [ _, scheme, hostname, port, pathAndQuery, _anchor ] = m;
    const schemeLower = scheme.toLowerCase();
    const hostnameLower = hostname.toLowerCase();
    const portPart = typeof port === 'string' && ((schemeLower === 'http' && port !== ':80') || (schemeLower === 'https' && port !== ':443')) ? port : '';
    return `${schemeLower}://${hostnameLower}${portPart}${pathAndQuery ?? ''}`;
}
