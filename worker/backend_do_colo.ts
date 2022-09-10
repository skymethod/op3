export class BackendDOColo {

    private static colo: string | undefined;

    static async get(): Promise<string> {
        if (!BackendDOColo.colo) {
            BackendDOColo.colo = await computeColo();
        }
        return BackendDOColo.colo;
    }

}

//

async function computeColo(): Promise<string> {
    const res = await fetch('https://1.1.1.1/cdn-cgi/trace');
    if (res.status !== 200) return res.status.toString();
    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.startsWith('colo=')) return line.substring('colo='.length);
    }
    return 'nocolo';
}
