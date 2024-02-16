import { EpisodeInfo } from '../worker/routes/api_shows_model.ts';
import { addDaysToDateString } from '../worker/timestamp.ts';
import { Chart, distinct, replacePlaceholders } from './deps.ts';
import { element, SlIconButton } from './elements.ts';
import { download } from './util.ts';

type Opts = { episodeHourlyDownloads: Record<string, Record<string, number>>, episodes: readonly EpisodeInfo[], showTitle: string | undefined, showSlug: string, mostRecentDate: string | undefined, shot: boolean, strings: Record<string, string> };

export const makeEpisodePacing = ({ episodeHourlyDownloads, episodes, showTitle, showSlug, mostRecentDate, shot, strings }: Opts) => {

    const [ 
        episodePacingPrevious, 
        episodePacingNext, 
        episodePacingShotHeader, 
        episodePacingCanvas, 
        episodePacingShotFooter,
        episodePacingLegendElement, 
        episodePacingNav,
        episodePacingNavCaption,
        episodePacingExportButton,
        episodePacingLegendItemTemplate
    ] = [
        element<SlIconButton>('episode-pacing-previous'),
        element<SlIconButton>('episode-pacing-next'),
        element('episode-pacing-shot-header'),
        element<HTMLCanvasElement>('episode-pacing'),
        element('episode-pacing-shot-footer'),
        element('episode-pacing-legend'),
        element('episode-pacing-nav'),
        element('episode-pacing-nav-caption'),
        element<SlIconButton>('episode-pacing-export'),
        element<HTMLTemplateElement>('episode-pacing-legend-item'),
    ];

    if (shot) {
        episodePacingShotHeader.classList.remove('hidden');
        episodePacingShotHeader.innerHTML = showTitle ?? '(untitled)';
        episodePacingShotFooter.classList.remove('hidden');
        episodePacingCanvas.style.marginLeft = episodePacingCanvas.style.marginRight = '4rem';
        document.body.style.backgroundColor = 'black';
        (document.querySelector('footer')! as HTMLElement).style.display = 'none';
        const main = document.querySelector('main');
        for (const node of main!.childNodes) {
            if (node instanceof HTMLElement) {
                if (node.id === 'episode-pacing-container') {
                    break;
                }
                node.style.display = 'none';
            }
        }
    }

    const pageSize = 8;
    let episodeIdsWithData: string[] = [];
    let episodeRelativeSummaries: Record<string, RelativeSummary> = {};
    let pages = 0;
    let maxPageIndex = 0;
    let pageIndex = 0;
    let final_ = false;
    let currentChart: Chart | undefined;

    function redrawChart() {
        if (currentChart) currentChart.destroy();
        currentChart = undefined;
        const pageEpisodeIds = episodeIdsWithData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
        const pageEpisodeRelativeSummaries = Object.fromEntries(pageEpisodeIds.map(v => [ v, episodeRelativeSummaries[v] ]));
        const suggestedMax = Math.max(...Object.values(pageEpisodeRelativeSummaries).map(v => Math.max(...Object.values(v.cumulative))));
        const episodeInfos = Object.fromEntries(episodes.map(v => [v.id, v]));
        const chart = drawPacingChart(episodePacingCanvas, pageEpisodeRelativeSummaries, suggestedMax, episodeInfos, shot, strings);
        initLegend(chart, episodePacingLegendItemTemplate, episodePacingLegendElement, episodePacingNav, pageEpisodeRelativeSummaries);
        
        currentChart = chart;
    }

    function updateEpisodeHourlyDownloads(episodeHourlyDownloads: Record<string, Record<string, number>> | undefined, final: boolean) {
        if (final) console.log(`updateEpisodeHourlyDownloadsFinal: changed=${!!episodeHourlyDownloads}`);
        final_ = final;
        if (episodeHourlyDownloads) {
            episodeIdsWithData = episodes.filter(v => episodeHourlyDownloads[v.id]).map(v => v.id);
            episodeRelativeSummaries = Object.fromEntries(Object.entries(episodeHourlyDownloads).map(v => [ v[0], computeRelativeSummary(v[1]) ]));
            pages = Math.ceil(episodeIdsWithData.length / pageSize);
            maxPageIndex = pages - 1;
        }
        episodePacingExportButton.style.visibility = final_ ? 'visible' : 'hidden';
        if (final) update();
    }
    updateEpisodeHourlyDownloads(episodeHourlyDownloads, false);
    redrawChart();

    episodePacingPrevious.onclick = () => {
        if (pageIndex > 0) {
            pageIndex--;
            redrawChart();
            update();
        }
    }

    episodePacingNext.onclick = () => {
        if (pageIndex < maxPageIndex && final_) {
            pageIndex++;
            redrawChart();
            update();
        }
    }


    if (mostRecentDate) episodePacingExportButton.onclick = () => {
        const tsvRows: string[][] = [];
        tsvRows.push([ 'episode_title', 'episode_pub_date', 'downloads_3_day', 'downloads_7_day', 'downloads_30_day', 'downloads_all_time', 'downloads_asof' ]);
        const formatForTsv = (downloads: number | undefined) => (downloads === undefined || downloads === 0) ? '' : downloads.toString();
        const asof = `${addDaysToDateString(mostRecentDate, 1)}T00:00:00.000Z`;
        for (const episode of episodes) {
            const summary = episodeRelativeSummaries[episode.id];
            if (!summary) continue;
            tsvRows.push([ 
                episode.title ?? '', 
                episode.pubdate ?? '',
                formatForTsv(summary.downloads3),
                formatForTsv(summary.downloads7),
                formatForTsv(summary.downloads30),
                formatForTsv(summary.downloadsAll),
                asof,
            ]);
        }
        const tsv = tsvRows.map(v => v.join('\t')).join('\n');
        const filename = `${showSlug}-episode-downloads.tsv`;
        download(tsv, { type: 'text/plain', filename });
    };

    function update() {
        episodePacingPrevious.disabled = pageIndex === 0;
        episodePacingNext.disabled = !final_ || pageIndex === maxPageIndex;
        episodePacingNavCaption.textContent = replacePlaceholders(strings.page_x_of_n, [ [ 'page', pageIndex + 1 ], [ 'pages', pages ] ]);
    }

    update();

    return { update, updateEpisodeHourlyDownloads };
};

//

const ZWSP = '\u200b';

const withCommas = new Intl.NumberFormat('en-US');

function bindDownloads(item: HTMLElement, selector: string, downloads?: number) {
    const downloadsN = item.querySelector(selector)!;
    downloadsN.textContent = downloads ? withCommas.format(downloads) : '—';
}

function initLegend(chart: Chart, episodePacingLegendItemTemplate: HTMLTemplateElement, episodePacingLegendElement: HTMLElement, episodePacingNav: HTMLElement, episodeRelativeSummaries: Record<string, RelativeSummary>) {
    const summaries = Object.values(episodeRelativeSummaries);
    // deno-lint-ignore no-explicit-any
    const items = (chart as any).options.plugins.legend.labels.generateLabels(chart);
    const legendSelections: Record<number, boolean> = {};

    const updateChartForLegend = () => {
        const noneSelected = Object.values(legendSelections).every(v => !v);
        for (const [ datasetIndex, selected ] of Object.entries(legendSelections)) {
            chart.setDatasetVisibility(parseInt(datasetIndex), noneSelected || selected);
        }
        chart.update();
    }

    while (episodePacingLegendElement.childElementCount > 7) episodePacingLegendElement.removeChild(episodePacingNav.previousElementSibling!);

    // deno-lint-ignore no-explicit-any
    (items as any[]).forEach((v, i) => {
        const { text, fillStyle, datasetIndex } = v;
        const summary = summaries[i];
        const item = episodePacingLegendItemTemplate.content.cloneNode(true) as HTMLElement;
        const dt = item.querySelector('dt')!;
        dt.style.backgroundColor = fillStyle;
        const dd = item.querySelector('dd')!;
        dd.textContent = text;
        bindDownloads(item, '.downloads-3', summary.downloads3);
        bindDownloads(item, '.downloads-7', summary.downloads7);
        bindDownloads(item, '.downloads-30', summary.downloads30);
        bindDownloads(item, '.downloads-all', summary.downloadsAll);
        legendSelections[datasetIndex] = false;
        const updateItem = () => {
            dt.style.opacity = legendSelections[datasetIndex] ? '1' : '0.9';
            dd.style.opacity = legendSelections[datasetIndex] ? '1' : '0.5';
        }
        updateItem();
        dd.onmouseover = () => {
            legendSelections[datasetIndex] = true;
            updateItem();
            updateChartForLegend();
        };
        dd.onmouseout = () => {
            legendSelections[datasetIndex] = false;
            updateItem();
            updateChartForLegend();
        }
        episodePacingLegendElement.insertBefore(item, episodePacingNav);
    });
}

type RelativeSummary = { cumulative: Record<string, number>, downloads3?: number, downloads7?: number, downloads30?: number, downloadsAll: number };

function computeRelativeSummary(hourlyDownloads: Record<string, number>): RelativeSummary {
    const cumulative: Record<string, number> = {};
    let downloads3: number | undefined;
    let downloads7: number | undefined;
    let downloads30: number | undefined;
    let hourNum = 1;
    let total = 0;
    for (const [ _hour, downloads ] of Object.entries(hourlyDownloads)) {
        total += downloads;
        if (hourNum <= 24 * 30) { // chart max 30 days
           cumulative[`h${(hourNum++).toString().padStart(4, '0')}`] = total;
        }
        if (hourNum === 3 * 24) downloads3 = total;
        if (hourNum === 7 * 24) downloads7 = total;
        if (hourNum === 30 * 24) downloads30 = total;
    }
    return { cumulative, downloadsAll: total, downloads3, downloads7, downloads30 };
}

function drawPacingChart(canvas: HTMLCanvasElement, episodeRelativeSummaries: Record<string, RelativeSummary>, suggestedMax: number, episodeInfos: Record<string, EpisodeInfo>, shot: boolean, strings: Record<string, string>): Chart {
    const allHours = distinct(Object.values(episodeRelativeSummaries).flatMap(v => Object.keys(v.cumulative)).sort());

    const parseHourLabel = (label: string) => {
        const hour = parseInt(label.substring(1));
        if (hour % 24 === 0) return replacePlaceholders(strings.day_n, Math.floor(hour / 24));
        return replacePlaceholders(strings.hour_n, Math.floor(hour));
    }

    const ctx = canvas.getContext('2d')!;

    const colors = [
        '#003f5c',
        '#2f4b7c',
        '#665191',
        '#a05195',
        '#d45087',
        '#f95d6a',
        '#ff7c43',
        '#ffa600',
    ].reverse();

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: allHours,
            datasets: Object.entries(episodeRelativeSummaries).map((v, i) => ({
                label: [ episodeInfos[v[0]] ].filter(v => v.pubdate).map(v => `${v.pubdate!.substring(0, 10)}: ${v.title}`).join(''),
                data: v[1].cumulative,
                backgroundColor: colors[i],
                borderColor: colors[i],
                borderWidth: 1,
                pointRadius: 0,
            }))
        },
        options: {
            animation: shot ? false : {
                duration: 100,
            },
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    enabled: true,
                    itemSort: (a, b) => b.parsed.y - a.parsed.y,
                    callbacks: {
                        title: v => parseHourLabel(v[0].label),
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        autoSkip: false,
                        callback: function(this, value) {
                            const hour = (value as number) + 1;
                            const label = hour % 24 === 0 ? ZWSP + replacePlaceholders(strings.day_n, Math.floor(hour / 24)) : '';
                            if (label !== '' && this.width < 700 && hour !== 24 && (hour / 24) % 5 !== 0) return '';
                            return label;
                        }
                    },
                    grid: {
                        color: ctx => (ctx.tick.label as string).startsWith(ZWSP) ? 'rgba(255, 255, 255, 0.1)' : undefined,
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                    },
                    beginAtZero: true,
                    suggestedMax,
                }
            }
        },
    });
}
