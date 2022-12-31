import { addMonthsToMonthString } from '../worker/timestamp.ts';
import { element, SlButton, SlDropdown, SlSwitch } from './elements.ts';
import { download } from './util.ts';

type Opts = { readonly showUuid: string, readonly showSlug: string, readonly previewToken: string };

export const makeExportDownloads = ({ showUuid, showSlug, previewToken }: Opts) => {

    const [ exportSpinner, exportIcon, exportTitleDiv, exportCancelButton, exportDropdown, exportOlderButton, exportBotsSwitch ] = [ 
        element('export-spinner'),
        element('export-icon'),
        element('export-title'),
        element('export-cancel'),
        element<SlDropdown>('export-dropdown'),
        element<SlButton>('export-older'),
        element<SlSwitch>('export-bots')
    ];

    let exporting: AbortController | undefined;
    let progress: number | undefined;

    const currentMonth = new Date().toISOString().substring(0, 7);
    const f = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const disables: { disabled: boolean }[] = [ exportOlderButton, exportBotsSwitch ];
    for (const monthNum of [ 0, 1, 2 ]) {
        const button = element<SlButton>(`export-month-${monthNum}`);
        const month = addMonthsToMonthString(currentMonth, -monthNum);
        button.textContent = f.format(new Date(`${month}-01T00:00:00Z`));
        button.title = month;
        button.onclick = async e => {
            const includeBots = exportBotsSwitch.checked;
            const controller = new AbortController();
            exportCancelButton.onclick = () => {
                controller.abort();
                exporting = undefined; update();
            }
            exporting = controller; progress = 0; update();
            try {
                await downloadDownloads(e, showUuid, showSlug, month, previewToken, includeBots, controller.signal, v => { progress = v; update(); });
            } finally {
                exporting = undefined; update();
            }
        }
        disables.push(button);
    }

    document.addEventListener('keydown', evt => {
        if (evt.key === 'Escape') {
            if (exporting) {
                exporting.abort();
                exporting = undefined; update();
            }
        }
    });

    function update() {
        if (exporting) {
            exportDropdown.open = false;
            exportSpinner.classList.remove('hidden');
            exportIcon.classList.add('hidden');
            exportCancelButton.classList.remove('invisible');
            exportTitleDiv.textContent = `Exporting${typeof progress === 'number' && progress > 0 ? ` (${(progress * 100).toFixed(0)}%)` : ''}...`;
        } else {
            exportSpinner.classList.add('hidden');
            exportIcon.classList.remove('hidden');
            exportCancelButton.classList.add('invisible');
            exportTitleDiv.textContent = 'Export download details';
        }
        disables.forEach(v => v.disabled = !!exporting);
    }

    update();

    return { update };
};

//

async function downloadDownloads(e: Event, showUuid: string, showSlug: string, month: string, previewToken: string, includeBots: boolean, signal: AbortSignal, onProgress: (progress: number) => void) {
    e.preventDefault();
    
    console.log(`download ${JSON.stringify({ month, includeBots })}`);

    const parts = [];
    let continuationToken;
    const qp = new URLSearchParams(document.location.search);
    while (true) {
        const u = new URL(`/api/1/downloads/show/${showUuid}`, document.location.href);
        if (qp.has('ro')) u.searchParams.set('ro', 'true');
        const limit = qp.get('limit') ?? '20000';
        u.searchParams.set('start', month);
        u.searchParams.set('end', addMonthsToMonthString(month, 1));
        u.searchParams.set('limit', limit);
        u.searchParams.set('token', previewToken);
        if (includeBots) u.searchParams.set('bots', 'include');
        if (continuationToken) {
            u.searchParams.set('continuationToken', continuationToken);
            u.searchParams.set('skip', 'headers');
        }
        console.log(`fetch limit=${limit} continuationToken=${continuationToken}`);
        const res = await fetch(u.toString(), { signal }); if (signal.aborted) return;
        if (res.status !== 200) throw new Error(`Unexpected status: ${res.status} ${await res.text()}`);
        const blob = await res.blob(); if (signal.aborted) return;
        parts.push(blob);
        continuationToken = res.headers.get('x-continuation-token');
        const done = typeof continuationToken !== 'string';
        const progress = done ? 1 : parseFloat(res.headers.get('x-progress') ?? '0');
        onProgress(progress);
        if (done) break;
    }
    if (signal.aborted) return;

    const { type } = parts[0];
    download(parts, { type, filename: `${showSlug}-downloads-${month}.tsv`});
}
