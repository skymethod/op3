import { encodeXml, importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet, computeHtml } from './html.ts';
import { computeNonProdHeader } from './instances.ts';
import { increment } from '../summaries.ts';

const costsHtm = await importText(import.meta.url, '../static/costs.htm');
const outputCss = await importText(import.meta.url, '../static/output.css');

export function computeCostsResponse(opts: { instance: string, hostname: string, origin: string, productionOrigin: string, cfAnalyticsToken: string | undefined }): Response {
    const { instance, hostname, origin, productionOrigin, cfAnalyticsToken } = opts;

    const html = computeHtml(costsHtm, {
        titleSuffix: instance === 'prod' ? '' : ` (${instance})`,
        styleTag: `<style>\n${outputCss}\n</style>`,
        productionOrigin, 
        nonProdHeader: computeNonProdHeader(instance, productionOrigin),
        cfAnalyticsSnippet: computeCloudflareAnalyticsSnippet(cfAnalyticsToken),
        origin,
        hostname,
        costsHtml: computeCostsHtml(),
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8'} });
}

//

interface Cost {
    readonly date: string;
    readonly description: string;
    readonly cost: number;
    readonly detail: readonly CostDetail[];
    readonly daysInYear?: Record<string, number>;
}

interface CostDetail {
    readonly description: string;
    readonly cost: number;
}

//

const COSTS: Cost[] = [
    {
        date: '2023-01-10',
        daysInYear: { '2022': 22, '2023': 9 },
        description: 'Cloudflare invoice',
        cost: 267.15,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 12.25 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 192.80 },
            { description: 'Durable Objects Storage', cost: 18.00 },
            { description: 'R2 Data Storage', cost: 0.05 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 16.55 },
        ]
    },
    {
        date: '2022-12-10',
        description: 'Cloudflare invoice',
        cost: 225.48,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 6.00 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 166.40 },
            { description: 'Durable Objects Storage', cost: 11.60 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 13.98 },
        ]
    },
    {
        date: '2022-11-10',
        description: 'Cloudflare invoice',
        cost: 179.79,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 4.95 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes', cost: 130.00 },
            { description: 'Durable Objects Storage', cost: 6.20 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 11.14 },
        ]
    },
    {
        date: '2022-10-15',
        description: 'Cloudflare invoice',
        cost: 9.29,
        detail: [
            { description: 'Advanced Certificate Manager (op3.st)', cost: 8.71 },
            { description: 'Sales Tax', cost: 0.58 },
        ]
    },
    {
        date: '2022-10-10',
        description: 'Cloudflare invoice',
        cost: 70.69,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 2.60 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes', cost: 45.80 },
            { description: 'Durable Objects Storage', cost: 0.40 },
            { description: 'Sales Tax', cost: 4.39 },
        ]
    },
    {
        date: '2022-09-11',
        description: 'Cloudflare invoice',
        cost: 5.33,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Sales Tax', cost: 0.33 },
        ]
    },
    {
        date: '2022-09-07',
        description: 'Domains invoice',
        cost: 38.22,
        detail: [
            { description: 'op3.st create 1 year', cost: 21.83 },
            { description: 'op3.dev create 1 year', cost: 16.39 },
        ]
    },
];

const COST_FORMATTER = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 });

const computeCostHtml = ({ date, description, cost, detail }: Cost) => `
        <details open>
            <summary class="grid grid-cols-5 gap-4 mt-0.5 md:mt-0 cursor-pointer">
                <div>${date}</div>
                <div class="col-span-3">${encodeXml(description)}</div>
                <div class="text-right">${COST_FORMATTER.format(cost)}</div>
            </summary>
${detail.map(({ description, cost }) => `
            <div class="grid grid-cols-5 gap-4 text-neutral-500 mt-0.5 md:mt-0">
                <div class="col-start-2 col-span-3">${encodeXml(description)}</div>
                <div class="text-right">${COST_FORMATTER.format(cost)}</div>
            </div>
`).join('\n')}
        </details>
`;

function computeCostsHtml(): string {
    const parts: string[] = [];

    const m = /<template id="ytd">(.*?)<\/template>/s.exec(costsHtm);
    if (!m) throw new Error();
    const [ _, template ] = m;

    const costsPerYear: Record<string, number> = {};
    COSTS.forEach((cost, i) => {
        parts.push(computeCostHtml(cost));
        const year = cost.date.substring(0, 4);
        if (cost.daysInYear) {
            const days = Object.values(cost.daysInYear).reduce((a, b) => a + b, 0);
            for (const [ year, yearDays ] of Object.entries(cost.daysInYear)) {
                const pct = yearDays / days;
                increment(costsPerYear, year, pct * cost.cost);
            }
        } else {
            increment(costsPerYear, year, cost.cost);
        }
        const nextYear = COSTS[i + 1] ? COSTS[i + 1].date.substring(0, 4) : undefined;
        if (year !== nextYear) {
            const isCurrentYear = year === COSTS[0].date.substring(0, 4);
            const ytd = template.replace('total', `${year}${isCurrentYear ? ' YTD' : ' TOTAL'}`).replace('nnn.nn', COST_FORMATTER.format(costsPerYear[year]));
            parts.push(ytd);
        }
        if (nextYear === undefined) {
            const total = template.replace('total', 'TOTAL').replace('nnn.nn', COST_FORMATTER.format(COSTS.map(v => v.cost).reduce((a, b) => a + b, 0)));
            parts.push(total);
        }
    });
    return parts.join('\n');
}
