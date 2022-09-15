import { importText } from '../deps.ts';
import { computeHtml } from './html.ts';

const headerHtm = await importText(import.meta.url, '../static/header.htm');

export function computeNonProdWarning(instance: string): string | undefined {
    return instance === 'ci' ? `CI INSTANCE: This instance is redeployed on every codebase change!`
    : instance === 'staging' ? `STAGING INSTANCE: This instance is used for testing and staging production-candidate releases.`
    : instance !== 'prod' ? `NON-PRODUCTION INSTANCE: This instance is a non-production version, and may be redeployed often for testing.`
    : undefined;
}

export function computeNonProdHeader(instance: string, productionOrigin: string): string {
    const nonProdWarning = computeNonProdWarning(instance);
    return nonProdWarning ? computeHtml(headerHtm, { nonProdWarning, productionOrigin }) : '';
}
