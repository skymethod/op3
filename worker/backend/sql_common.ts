import { DurableObjectStorage } from '../deps.ts';
import { Unkinded, ExecuteSqlRequest, ExecuteSqlResponse } from '../rpc_model.ts';

export async function executeSqlCommon(req: Unkinded<ExecuteSqlRequest>, storage: DurableObjectStorage): Promise<Unkinded<ExecuteSqlResponse>> {
    await Promise.resolve();
    const { sql } = storage; 
    const rt: Unkinded<ExecuteSqlResponse> = { results: [] };
    storage.transactionSync(() => {
        for (const { q, params = [] } of req.statements) {
            if (q === 'size') {
                const { databaseSize } = sql;
                rt.results.push({ rows: [ { databaseSize } ], rowsRead: 0, rowsWritten: 0 });
            } else {
                const c = sql.exec(q, ...params);
                const { rowsRead, rowsWritten } = c;
                const rows = c.toArray();
                rt.results.push({ rows, rowsRead, rowsWritten });
            }
        }
    });
    return rt;
}
