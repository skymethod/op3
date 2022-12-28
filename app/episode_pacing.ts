import { EpisodeInfo } from '../worker/routes/api_shows_model.ts';
import { Chart, distinct } from './deps.ts';
import { element } from './elements.ts';

type Opts = { episodeHourlyDownloads: Record<string, Record<string, number>>, episodes: readonly EpisodeInfo[] };

export const makeEpisodePacing = ({ episodeHourlyDownloads, episodes }: Opts) => {

    const [ episodePacingCanvas ] = [ 
        element<HTMLCanvasElement>('episode-pacing')
    ];

    const recentEpisodeIds = episodes.filter(v => episodeHourlyDownloads[v.id]).slice(0, 8).map(v => v.id);
    const recentEpisodeHourlyDownloads = Object.fromEntries(recentEpisodeIds.map(v => [ v, episodeHourlyDownloads[v] ]));
    const episodeInfos = Object.fromEntries(episodes.map(v => [v.id, v]));
    drawPacingChart(episodePacingCanvas, recentEpisodeHourlyDownloads, episodeInfos);
    
    function update() {
       
    }

    update();

    return { update };
};

//

function computeRelativeCumulative(hourlyDownloads: Record<string, number>): Record<number, number> {
    const rt: Record<string, number> = {};
    let hourNum = 1;
    let total = 0;
    for (const [ _hour, downloads ] of Object.entries(hourlyDownloads)) {
        total += downloads;
        rt[`h${(hourNum++).toString().padStart(3, '0')}`] = total;
    }
    return rt;
}

function drawPacingChart(canvas: HTMLCanvasElement, episodeHourlyDownloads: Record<string, Record<string, number>>, episodeInfos: Record<string, EpisodeInfo>): Chart {
    const episodeRelativeCumulative = Object.fromEntries(Object.entries(episodeHourlyDownloads).map(v => [ v[0], computeRelativeCumulative(v[1]) ]));
    const allHours = distinct(Object.values(episodeRelativeCumulative).flatMap(v => Object.keys(v)).sort());

    const parseHourLabel = (label: string) => {
        const hour = parseInt(label.substring(1));
        return (hour > 1 && (hour - 1) % 24) === 0 ? `Day ${Math.floor((hour - 1) / 24)}` : `Hour ${hour}`;
    }

    const ctx = canvas.getContext('2d')!;

    const colors =[
        '#003f5c',
        '#2f4b7c',
        '#665191',
        '#a05195',
        '#d45087',
        '#f95d6a',
        '#ff7c43',
        '#ffa600',
    ];
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: allHours,
            datasets: Object.entries(episodeRelativeCumulative).map((v, i) => ({
                label: [ episodeInfos[v[0]] ].map(v => `${v.pubdate.substring(0, 10)}: ${v.title}`).join(''),
                data: v[1],
                backgroundColor: colors[i],
                borderColor: colors[i],
                borderWidth: 1,
                pointRadius: 0,
            }))
        },
        options: {
            
            animation: {
                duration: 100,
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    align: 'start',
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
                        callback: function(this, value) {
                            const label = this.getLabelForValue(value as number);
                            return parseHourLabel(label);
                        }
                    },
                    grid: {
                        color: ctx => (ctx.tick.label as string).startsWith('Day') ? 'rgba(255, 255, 255, 0.1)' : undefined,
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                    }
                }
            }
        },
    });
}
