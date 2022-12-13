export class ManualColo {

    private static colo: string | undefined;

    static async get(): Promise<string> {
        if (!ManualColo.colo) {
            ManualColo.colo = await computeColo();
        }
        return ManualColo.colo;
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
