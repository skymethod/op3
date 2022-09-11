import { parse } from 'https://deno.land/std@0.155.0/flags/mod.ts';

const args = parse(Deno.args);

const positional = args._;

if (positional[0] === 'data' && positional.length === 3) {
    const { token, origin, 'dry-run': dryRunOpt } = args;
    const dryRun = typeof dryRunOpt === 'boolean' ? dryRunOpt : typeof dryRunOpt === 'string' ? (dryRunOpt === 'true' ? true : dryRunOpt === 'false' ? false : null) : null;
    if (dryRun === null) throw new Error(`'dry-run' is a boolean flag`);
    
    const requestBody = { operationKind: positional[1], targetPath: positional[2], dryRun };
    if (typeof token !== 'string') throw new Error(`'token' is required`);
    if (typeof origin !== 'string') throw new Error(`'origin' is required`);
    const res = await fetch(origin + '/api/1/admin/data', { method: 'POST', body: JSON.stringify(requestBody), headers: { authorization: `Bearer ${token}`} });
    const obj = await res.json();
    if (res.status !== 200) {
        const { error } = obj;
        console.error(error);
    } else {
        console.log(JSON.stringify(obj, undefined, 2));
    }
}
