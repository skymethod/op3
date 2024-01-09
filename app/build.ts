import { transform, stop } from 'https://deno.land/x/esbuild@v0.16.10/mod.js';
import { toArrayBuffer } from 'https://deno.land/std@0.211.0/streams/to_array_buffer.ts';

async function fileExists(filePath: string | URL): Promise<boolean> {
    try {
        await Deno.lstat(filePath);
        return true;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return false;
        }
        throw error;
    }
}

const text = new TextDecoder().decode(await toArrayBuffer(Deno.stdin.readable));
const [ output ] = Deno.args;

if (!fileExists(output)) throw new Error(`Output file must exist`);

const { code } = await transform(text, { treeShaking: true, target: 'es2020' });
const outputJs = `// deno-lint-ignore-file\n${code}`;
await Deno.writeTextFile(output, outputJs);

stop();
