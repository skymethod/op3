import { TextLineStream } from './deps.ts';

export function computeLinestream(stream: ReadableStream<Uint8Array>): ReadableStream<string> {
    return stream
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream());
}
