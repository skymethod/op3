import { undefinedIfBlank } from './check.ts';
import { TextLineStream } from './deps.ts';

export function computeLinestream(stream: ReadableStream<Uint8Array>): ReadableStream<string> {
    return stream
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream());
}

export async function* yieldTsvFromStream(stream: ReadableStream<Uint8Array>) {
    const lines = computeLinestream(stream);
    let headers: string[] | undefined;
    let lineNum = 0;
    for await (const line of lines) {
        lineNum++;
        if (line === '') continue;
        const values = line.split('\t');
        if (!headers) {
            headers = values;
            continue;
        }
        if (headers.length !== values.length) throw new Error(`Bad tsv at line ${lineNum}: expected ${headers.length} fields, found ${values.length}`);
        yield Object.fromEntries(headers.map((v, i) => [ v, undefinedIfBlank(values[i]) ]));
    }
}
