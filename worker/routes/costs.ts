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
        date: '2024-06-10',
        description: 'Cloudflare invoice',
        cost: 763.94,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 22.16 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 396.60 },
            { description: 'Durable Objects Storage', cost: 198.80 },
            { description: 'R2 Data Storage', cost: 11.76 },
            { description: 'R2 Storage Operations', cost: 9.00 },
            { description: 'Queues Operations', cost: 50.80 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 47.32 },
        ]
    },
    {
        date: '2024-05-10',
        description: 'Cloudflare invoice',
        cost: 951.51,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 34.33 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 570.00 },
            { description: 'Durable Objects Storage', cost: 188.00 },
            { description: 'R2 Data Storage', cost: 10.07 },
            { description: 'R2 Storage Operations', cost: 9.00 },
            { description: 'Queues Operations', cost: 47.20 },
            { description: 'KV Operations', cost: 6.50 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 58.91 },
        ]
    },
    {
        date: '2024-04-10',
        description: 'Cloudflare invoice',
        cost: 791.97,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 35.15 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 427.60 },
            { description: 'Durable Objects Storage', cost: 187.20 },
            { description: 'R2 Data Storage', cost: 8.87 },
            { description: 'R2 Storage Operations', cost: 9.00 },
            { description: 'Queues Operations', cost: 41.60 },
            { description: 'KV Operations', cost: 6.00 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 49.05 },
        ]
    },
    {
        date: '2024-03-10',
        description: 'Cloudflare invoice',
        cost: 679.83,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 32.36 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 404.40 },
            { description: 'Durable Objects Storage', cost: 162.00 },
            { description: 'R2 Data Storage', cost: 6.95 },
            { description: 'R2 Storage Operations', cost: 4.50 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 42.12 },
        ]
    },
    {
        date: '2024-02-10',
        description: 'Cloudflare invoice',
        cost: 729.97,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 41.45 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 442.40 },
            { description: 'Durable Objects Storage', cost: 161.80 },
            { description: 'R2 Data Storage', cost: 7.10 },
            { description: 'R2 Storage Operations', cost: 4.50 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 45.22 },
        ]
    },
    {
        date: '2024-01-10',
        description: 'Cloudflare invoice',
        cost: 741.85,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 33.85 },
            { description: 'Durable Objects Compute', cost: 25.00 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 668.80 },
            { description: 'Durable Objects Storage', cost: 152.40 },
            { description: 'R2 Data Storage', cost: 4.85 },
            { description: 'R2 Storage Operations', cost: 4.50 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 59.71 },
            { description: 'Refund', cost: -222.26 },
        ]
    },
    {
        date: '2023-12-10',
        description: 'Cloudflare invoice',
        cost: 714.55,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 43.35 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 452.20 },
            { description: 'Durable Objects Storage', cost: 138.80 },
            { description: 'R2 Data Storage', cost: 3.93 },
            { description: 'R2 Storage Operations', cost: 4.50 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 44.27 },
        ]
    },
    {
        date: '2023-11-10',
        description: 'Cloudflare invoice',
        cost: 528.00,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 30.90 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 341.40 },
            { description: 'Durable Objects Storage', cost: 93.20 },
            { description: 'R2 Data Storage', cost: 2.30 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 32.70 },
        ]
    },
    {
        date: '2023-10-10',
        description: 'Cloudflare invoice',
        cost: 624.01,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 47.90 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 404.80 },
            { description: 'Durable Objects Storage', cost: 102.80 },
            { description: 'R2 Data Storage', cost: 2.39 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 38.62 },
        ]
    },
    {
        date: '2023-09-10',
        description: 'Cloudflare invoice',
        cost: 644.15,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 49.60 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 436.2 },
            { description: 'Durable Objects Storage', cost: 89.00 },
            { description: 'R2 Data Storage', cost: 1.97 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 39.88 },
        ]
    },
    {
        date: '2023-08-10',
        description: 'Cloudflare invoice',
        cost: 502.86,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 34.15 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 341.60 },
            { description: 'Durable Objects Storage', cost: 67.20 },
            { description: 'R2 Data Storage', cost: 1.26 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 31.15 },
        ]
    },
    {
        date: '2023-08-06',
        description: 'Domains invoice',
        cost: 54.98,
        detail: [
            { description: 'op3.st renew 1 year', cost: 29.99 },
            { description: 'op3.dev renew 1 year', cost: 24.99 },
        ]
    },
    {
        date: '2023-07-10',
        description: 'Cloudflare invoice',
        cost: 412.61,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 23.80 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 273.80 },
            { description: 'Durable Objects Storage', cost: 60.80 },
            { description: 'R2 Data Storage', cost: 1.14 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 25.57 },
        ]
    },
    {
        date: '2023-06-10',
        description: 'Cloudflare invoice',
        cost: 400.91,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 24.10 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 270.20 },
            { description: 'Durable Objects Storage', cost: 53.60 },
            { description: 'R2 Data Storage', cost: 0.68 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 24.83 },
        ]
    },
    {
        date: '2023-05-10',
        description: 'Cloudflare invoice',
        cost: 372.09,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 22.55 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 255.40 },
            { description: 'Durable Objects Storage', cost: 43.00 },
            { description: 'R2 Data Storage', cost: 0.60 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 23.04 },
        ]
    },
    {
        date: '2023-04-10',
        description: 'Cloudflare invoice',
        cost: 357.08,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 22.55 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 249.40 },
            { description: 'Durable Objects Storage', cost: 35.00 },
            { description: 'R2 Data Storage', cost: 0.53 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 22.10 },
        ]
    },
    {
        date: '2023-03-10',
        description: 'Cloudflare invoice',
        cost: 559.45,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 19.10 },
            { description: 'Durable Objects Compute', cost: 25.00 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 439.60 },
            { description: 'Durable Objects Storage', cost: 25.80 },
            { description: 'R2 Data Storage', cost: 0.30 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 34.65 },
        ]
    },
    {
        date: '2023-02-10',
        description: 'Cloudflare invoice',
        cost: 383.92,
        detail: [
            { description: 'Workers Paid Subscription', cost: 5.00 },
            { description: 'Workers requests', cost: 20.05 },
            { description: 'Durable Objects Compute', cost: 12.50 },
            { description: 'Durable Objects Reads/Writes/Deletes', cost: 284.60 },
            { description: 'Durable Objects Storage', cost: 27.80 },
            { description: 'R2 Data Storage', cost: 0.20 },
            { description: 'Advanced Certificate Manager (op3.st)', cost: 10.00 },
            { description: 'Sales Tax', cost: 23.77 },
        ]
    },
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
