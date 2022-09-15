import { importText } from '../deps.ts';
import { computeHtml } from './html.ts';

const footerHtm = await importText(import.meta.url, '../static/footer.htm');

export function computeVersionFooter(deploySha: string | undefined, deployTime: string | undefined) {
    if (typeof deploySha === 'string' && typeof deployTime === 'string') {
        return computeHtml(footerHtm, { deploySha, deployTime });
    }
    return '';
}
