import { Configuration } from '../configuration.ts';
import { QUERY_DOWNLOADS, QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS, QUERY_HITS, computeApiVersion } from './api_contract.ts';
import { computeNonProdWarning } from './instances.ts';

export async function computeApiDocsSwaggerResponse(opts: { instance: string, origin: string, previewTokens: Set<string>, configuration: Configuration | undefined, searchParams: URLSearchParams }): Promise<Response> {
    const { instance: instanceOpt, origin, previewTokens, configuration, searchParams } = opts;
    const { host } = new URL(origin);

    const templateMode = searchParams.has('template');
    const instanceParam = templateMode ? (searchParams.get('instance') ?? undefined) : undefined;
    const instance = instanceParam ?? instanceOpt;
    const version = templateMode ? 'API_VERSION_TEMPLATE' : computeApiVersion(instance);
    let descriptionSuffix = `\n\n# Endpoint\n\nBase url for all API calls: \`${origin}/api/1\`\n\n# Authentication\n\nEvery call to the OP3 API requires a bearer token associated with a valid API Key.\n\n> [Manage your API Keys and bearer tokens →](/api/keys)\n\nPass your bearer token either: \n - as an authorization header: \`Authorization: Bearer mytoken\`\n - or using this query param: \`?token=mytoken\`\n\n`;
    let queryHitsDescriptionSuffix = '';
    let queryDownloadsDescriptionSuffix = '';
    let viewShowDescriptionSuffix = '';
    let queryRecentEpisodesWithTranscriptsDescriptionSuffix = '';
    let queryTopAppsForShowDescriptionSuffix = '';
    let queryTopAppsDescriptionSuffix = '';
    let queryShowDownloadCountsDescriptionSuffix = '';

    const previewToken = templateMode ? 'PREVIEW_TOKEN_TEMPLATE' : [...previewTokens].at(0);
    let demoShowUuid: string | undefined;
    if (previewToken) {
        descriptionSuffix += `\n\nYou can also use the sample bearer token \`${previewToken}\` to preview API access on this instance.`;

        const exampleHitsApiCall = `${origin}/api/1/hits?start=-24h&format=json&token=${previewToken}`;
        queryHitsDescriptionSuffix = `\n\nFor example, to view hits starting 24 hours ago in json format:\n\n\GET [${exampleHitsApiCall}](${exampleHitsApiCall})`;

        demoShowUuid = templateMode ? 'DEMO_SHOW_UUID_TEMPLATE' : await configuration?.get('demo-show-1');
        if (demoShowUuid) {
            const exampleDownloadsApiCall = `${origin}/api/1/downloads/show/${demoShowUuid}?start=2023-02&end=2023-03&limit=10&format=json&token=${previewToken}`;
            queryDownloadsDescriptionSuffix = `\n\nFor example, to view the first ten downloads for show \`${demoShowUuid}\` in the month of February 2023 in json format:\n\n\GET [${exampleDownloadsApiCall}](${exampleDownloadsApiCall})`;

            const exampleViewShowApiCall = `${origin}/api/1/shows/${demoShowUuid}?token=${previewToken}`;
            viewShowDescriptionSuffix = `\n\nExample call (without episodes):\n\n\GET [${exampleViewShowApiCall}](${exampleViewShowApiCall})`;

            const exampleQueryTopAppsForShowApiCall = `${origin}/api/1/queries/top-apps-for-show?showUuid=${demoShowUuid}&token=${previewToken}`;
            queryTopAppsForShowDescriptionSuffix = `\n\nFor example:\n\n\GET [${exampleQueryTopAppsForShowApiCall}](${exampleQueryTopAppsForShowApiCall})`;

            const exampleQueryTopAppsApiCall = `${origin}/api/1/queries/top-apps?token=${previewToken}`;
            queryTopAppsDescriptionSuffix = `\n\nFor example:\n\n\GET [${exampleQueryTopAppsApiCall}](${exampleQueryTopAppsApiCall})`;

            const exampleQueryShowDownloadCountsApiCall = `${origin}/api/1/queries/show-download-counts?showUuid=${demoShowUuid}&token=${previewToken}`;
            queryShowDownloadCountsDescriptionSuffix = `\n\nFor example:\n\n\GET [${exampleQueryShowDownloadCountsApiCall}](${exampleQueryShowDownloadCountsApiCall})`;
        }

        viewShowDescriptionSuffix += `\n\n> **Public show stats pages**\n>\n>The canonical OP3 stats page for the show is returned in the \`statsPageUrl\` response field, but in general are available at \`${origin}/show/<show-uuid-or-podcast-guid>\``;
        if (demoShowUuid) {
            const exampleShowPageUrl = `${origin}/show/${demoShowUuid}`;
            viewShowDescriptionSuffix += `\n>\n> e.g. [${exampleShowPageUrl}](${exampleShowPageUrl})`
        }

        const exampleQueryRecentEpisodesApiCall = `${origin}/api/1/queries/recent-episodes-with-transcripts?limit=5&token=${previewToken}`;
        queryRecentEpisodesWithTranscriptsDescriptionSuffix = `\n\nFor example, to find the last five episodes with transcripts:\n\n\GET [${exampleQueryRecentEpisodesApiCall}](${exampleQueryRecentEpisodesApiCall})`;

    }

    const nonProdWarning = computeNonProdWarning(instance);
    if (nonProdWarning) descriptionSuffix += `\n\n# This is not production!\n\n**${nonProdWarning}**`;
    
    const swagger = computeSwagger(origin, host, version, descriptionSuffix, queryHitsDescriptionSuffix, queryDownloadsDescriptionSuffix, viewShowDescriptionSuffix, queryRecentEpisodesWithTranscriptsDescriptionSuffix, queryTopAppsForShowDescriptionSuffix, queryTopAppsDescriptionSuffix, queryShowDownloadCountsDescriptionSuffix);
    const json = JSON.stringify(swagger, undefined, 2);
    return new Response(json, { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

//

const computeSwagger = (origin: string, host: string, version: string, descriptionSuffix: string, queryHitsDescriptionSuffix: string, queryDownloadsDescriptionSuffix: string, viewShowDescriptionSuffix: string, queryRecentEpisodesWithTranscriptsDescriptionSuffix: string, queryTopAppsForShowDescriptionSuffix: string, queryTopAppsDescriptionSuffix: string, queryShowDownloadCountsDescriptionSuffix: string) => (
    {
        "swagger": "2.0",
        "info": {
            "description": `The [Open Podcast Prefix Project](${origin}) is an open-source [podcast prefix analytics service](https://soundsprofitable.com/update/prefix-analytics) committed to open data and listener privacy.\n\nThis API serves as an interface to access the data collected in a privacy-preserving way.${descriptionSuffix}`,
            "version": version,
            "title": "OP3 API",
            "termsOfService": `${origin}/terms/`,
            "contact": {
                "email": "john@op3.dev"
            },
            "license": {
                "name": "MIT",
                "url": "https://github.com/skymethod/op3/blob/master/LICENSE"
            }
        },
        "host": host,
        "basePath": "/api/1",
        "tags": [
            {
                "name": "hits",
                "description": `Lowest-level log records saved for every prefix redirect processed.\n\nThis is the raw material on which higher-level metrics like [downloads](#tag/downloads) can be [derived](${origin}/download-calculation).`,
            },
        ],
        "schemes": [
            "https",
        ],
        "paths": {
            "/hits": {
                "get": {
                    "tags": [
                        "hits"
                    ],
                    "summary": "Query hits",
                    "description": `Perform a query of every request ("hit") logged using the redirect.\n\nThis can be used to verify that requests are stored properly in the system.\n\nResults are returned in ascending order by time (plus uuid to break ties for multiple requests in the same millisecond) unless the \`desc\` param is specified.\n\nYou can filter by a time range and one additional optional dimension (\`url\` or \`hashedIpAddress\`, which only have data for the last 90 days).${queryHitsDescriptionSuffix}`,
                    "operationId": "queryHits",
                    "produces": [
                        "application/json",
                        "text/tab-separated-values"
                    ],
                    "parameters": [
                        {
                            "name": "token",
                            "in": "query",
                            "description": "Pass your bearer token either: \n - as an authorization header: `Authorization: Bearer mytoken`\n - or using this query param: `?token=mytoken`\n\nSee the [Authentication](#section/Authentication) section above for how to obtain a token.",
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "format",
                            "in": "query",
                            "description": "Output format\n\nDefaults to tab-separated text (`tsv`), but also supports a object-based `json` format (aka `json-o`) or a more compact array-based `json-a` format.",
                            "required": false,
                            "default": "tsv",
                            "enum": [
                                "tsv",
                                "json",
                                "json-o",
                                "json-a",
                            ]
                        },
                        {
                            "name": "limit",
                            "in": "query",
                            "description": "Maximum number of rows to return",
                            "required": false,
                            "type": "integer",
                            "maximum": QUERY_HITS.limitMax,
                            "minimum": QUERY_HITS.limitMin,
                            "default": QUERY_HITS.limitDefault,
                        },
                        {
                            "name": "start",
                            "in": "query",
                            "description": "Filter by start time (inclusive) using a timestamp, date, or relative time (e.g. `-24h`)\n\nYou can specify either `start` or `startAfter`, not both",
                            "example": "2022-09-15T14:00:52.709Z",
                            "required": false,
                            "type": "string",
                            "format": "ISO 8601 timestamp, date, or relative duration",
                        },
                        {
                            "name": "startAfter",
                            "in": "query",
                            "description": "Filter by start time (exclusive) using a timestamp, date, or relative time (e.g. `-24h`)\n\nYou can specify either `start` or `startAfter`, not both",
                            "example": "2022-09-15T14:00:52.709Z",
                            "required": false,
                            "type": "string",
                            "format": "ISO 8601 timestamp, date, or relative duration",
                        },
                        {
                            "name": "end",
                            "in": "query",
                            "description": "Filter by end time (exclusive) using a timestamp, date, or relative time (e.g. `-24h`)",
                            "example": "2022-09-15T14:00:52.709Z",
                            "required": false,
                            "type": "string",
                            "format": "ISO 8601 timestamp, date, or relative duration",
                        },
                        {
                            "name": "url",
                            "in": "query",
                            "description": `Filter by a specific episode url\n\nAlso supports trailing wildcards, i.e. "starts with" queries.\n\nExample: \`url=${origin}/e/example.com/path/to/*\``,
                            "example": `${origin}/e/example.com/path/to/episode.mp3`,
                            "required": false,
                            "type": "string",
                            "format": "url",
                        },
                        {
                            "name": "hashedIpAddress",
                            "in": "query",
                            "description": "Filter by a specific IP address secure hash\n\nRaw IP addresses are never stored, only their secure hash, using rotating keys\n\nYou can specify `hashedIpAddress=current` to use the value corresponding to your current IP address",
                            "example": `a3f1b92bc53ff9512253be45bc9c60047bddad55`,
                            "required": false,
                            "type": "40-character hex",
                        },
                        {
                            "name": "desc",
                            "in": "query",
                            "description": `If provided, sorts the results in time-descending order (most recent first)`,
                            "required": false,
                            "type": "boolean",
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "successful operation",
                            "schema": {
                                "$ref": "#/definitions/QueryHitsResponse"
                            }
                        }
                    },
                    "security": [
                        {
                            "bearer_token_or_token_query_param": []
                        }
                    ]
                }
            },
            "/downloads/show/{showUuid}": {
                "get": {
                    "tags": [
                        "downloads"
                    ],
                    "summary": `Query show downloads`,
                    "description": `Perform a query of show [downloads](${origin}/download-calculation).\n\nResults are returned in ascending order by time.${queryDownloadsDescriptionSuffix}`,
                    "operationId": "queryShowDownloads",
                    "produces": [
                        "application/json",
                        "text/tab-separated-values"
                    ],
                    "parameters": [
                        {
                            "name": "showUuid",
                            "in": "path",
                            "description": "Filter by the OP3 show uuid",
                            "example": `3299ee267635404e9cd660088a755b34`,
                            "required": true,
                            "type": "string",
                            "format": "32-character hex",
                        },
                        {
                            "name": "token",
                            "in": "query",
                            "description": "Pass your bearer token either: \n - as an authorization header: `Authorization: Bearer mytoken`\n - or using this query param: `?token=mytoken`\n\nSee the [Authentication](#section/Authentication) section above for how to obtain a token.",
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "format",
                            "in": "query",
                            "description": "Output format\n\nDefaults to tab-separated text (`tsv`), but also supports a object-based `json` format (aka `json-o`) or a more compact array-based `json-a` format.",
                            "required": false,
                            "default": "tsv",
                            "enum": [
                                "tsv",
                                "json",
                                "json-o",
                                "json-a",
                            ]
                        },
                        {
                            "name": "limit",
                            "in": "query",
                            "description": "Maximum number of rows to return",
                            "required": false,
                            "type": "integer",
                            "maximum": QUERY_DOWNLOADS.limitMax,
                            "minimum": QUERY_DOWNLOADS.limitMin,
                            "default": QUERY_DOWNLOADS.limitDefault,
                        },
                        {
                            "name": "start",
                            "in": "query",
                            "description": "Filter by start time (inclusive) using a timestamp, date, or relative time (e.g. `-24h`)\n\nYou can specify either `start` or `startAfter`, not both",
                            "example": "2023-02-23T21:01:45.797Z",
                            "required": false,
                            "type": "string",
                            "format": "ISO 8601 timestamp, date, or relative duration",
                        },
                        {
                            "name": "startAfter",
                            "in": "query",
                            "description": "Filter by start time (exclusive) using a timestamp, date, or relative time (e.g. `-24h`)\n\nYou can specify either `start` or `startAfter`, not both",
                            "example": "2023-02-23T21:01:45.797Z",
                            "required": false,
                            "type": "string",
                            "format": "ISO 8601 timestamp, date, or relative duration",
                        },
                        {
                            "name": "end",
                            "in": "query",
                            "description": "Filter by end time (exclusive) using a timestamp, date, or relative time (e.g. `-24h`)",
                            "example": "2023-02-23T21:01:45.797Z",
                            "required": false,
                            "type": "string",
                            "format": "ISO 8601 timestamp, date, or relative duration",
                        },
                        {
                            "name": "episodeId",
                            "in": "query",
                            "description": "Filter by the OP3 episode id",
                            "example": `6e3c647698c647939f479e6e0b822ec7a2eaa30b4ca5488d8eeb8b08ac22cdf7`,
                            "required": false,
                            "type": "string",
                            "format": "64-character hex",
                        },
                        {
                            "name": "bots",
                            "in": "query",
                            "description": `Whether or not to include downloads from known bots`,
                            "required": false,
                            "default": "exclude",
                            "enum": [
                                "include",
                                "exclude",
                            ]
                        },
                        {
                            "name": "skip",
                            "in": "query",
                            "description": "Whether or not to skip specific response metadata like TSV headers",
                            "required": false,
                            "enum": [
                                "headers",
                            ]
                        },
                        {
                            "name": "continuationToken",
                            "in": "query",
                            "description": "Continue a prior query if necessary",
                            "required": false,
                            "type": "string",
                            "format": "Opaque token from a prior query response",
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": "successful operation",
                            "schema": {
                                "$ref": "#/definitions/QueryDownloadsResponse"
                            }
                        }
                    },
                    "security": [
                        {
                            "bearer_token_or_token_query_param": []
                        }
                    ]
                }
            },
            "/shows/{showUuidOrPodcastGuidOrFeedUrlBase64}": {
                "get": {
                    "tags": [
                        "shows"
                    ],
                    "summary": `View show information`,
                    "description": `Look up show-level information for a given OP3 show uuid, [\`podcast:guid\`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#guid) or podcast feed url (as [urlsafe base-64](https://www.base64url.com/)).\n\nIf an HTTP 404 response code is returned, OP3 doesn't know about the show.\n\nEpisode information is not included by default, but can be included with \`episodes=include\`.${viewShowDescriptionSuffix}`,
                    "operationId": "viewShowInformation",
                    "produces": [
                        "application/json",
                    ],
                    "parameters": [
                        {
                            "name": "showUuidOrPodcastGuidOrFeedUrlBase64",
                            "in": "path",
                            "description": "A given OP3 show uuid, [\`podcast:guid\`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#guid), or podcast feed url (as [urlsafe base-64](https://www.base64url.com/)).",
                            "example": `3299ee267635404e9cd660088a755b34`,
                            "required": true,
                            "type": "string",
                            "format": "32-character hex, guid, or urlsafe base-64",
                        },
                        {
                            "name": "token",
                            "in": "query",
                            "description": "Pass your bearer token either: \n - as an authorization header: `Authorization: Bearer mytoken`\n - or using this query param: `?token=mytoken`\n\nSee the [Authentication](#section/Authentication) section above for how to obtain a token.",
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "episodes",
                            "in": "query",
                            "type": "enum",
                            "description": `Whether or not to include episode information as well.`,
                            "required": false,
                            "default": "exclude",
                            "enum": [
                                "include",
                                "exclude",
                            ]
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "successful operation",
                            "schema": {
                                "$ref": "#/definitions/ViewShowResponse"
                            }
                        }
                    },
                    "security": [
                        {
                            "bearer_token_or_token_query_param": []
                        }
                    ]
                }
            },
            "/queries/recent-episodes-with-transcripts": {
                "get": {
                    "tags": [
                        "queries"
                    ],
                    "summary": "Query recent episodes with transcripts",
                    "description": `List all episodes with [\`podcast:transcript\`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#transcript) tags.\n\nResults are returned in reverse chronological order (newest to oldest).${queryRecentEpisodesWithTranscriptsDescriptionSuffix}`,
                    "operationId": "queryRecentEpisodesWithTranscripts",
                    "produces": [
                        "application/json",
                    ],
                    "parameters": [
                        {
                            "name": "token",
                            "in": "query",
                            "description": "Pass your bearer token either: \n - as an authorization header: `Authorization: Bearer mytoken`\n - or using this query param: `?token=mytoken`\n\nSee the [Authentication](#section/Authentication) section above for how to obtain a token.",
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "limit",
                            "in": "query",
                            "description": "Maximum number of rows to return",
                            "required": false,
                            "type": "integer",
                            "maximum": QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMax,
                            "minimum": QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitMin,
                            "default": QUERY_RECENT_EPISODES_WITH_TRANSCRIPTS.limitDefault,
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": "successful operation",
                            "schema": {
                                "$ref": "#/definitions/QueryRecentEpisodesWithTranscriptsResponse"
                            }
                        }
                    },
                    "security": [
                        {
                            "bearer_token_or_token_query_param": []
                        }
                    ]
                }
            },
            "/queries/top-apps-for-show": {
                "get": {
                    "tags": [
                        "queries"
                    ],
                    "summary": "Query the top apps for a given show",
                    "description": `List all apps downloading a given show over the last three calendar months.\n\nResults are returned in reverse order (most downloads to fewest).${queryTopAppsForShowDescriptionSuffix}`,
                    "operationId": "queryTopAppsForShow",
                    "produces": [
                        "application/json",
                    ],
                    "parameters": [
                        {
                            "name": "token",
                            "in": "query",
                            "description": "Pass your bearer token either: \n - as an authorization header: `Authorization: Bearer mytoken`\n - or using this query param: `?token=mytoken`\n\nSee the [Authentication](#section/Authentication) section above for how to obtain a token.",
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "showUuid",
                            "in": "query",
                            "description": "Specify the show by OP3 show uuid.\n\nMust provide either `showUuid`, `podcastGuid` or `feedUrlBase64`.",
                            "required": false,
                            "type": "string",
                            "format": "32-character hex",
                        },
                        {
                            "name": "podcastGuid",
                            "in": "query",
                            "description": "Specify the show by [\`podcast:guid\`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#guid).\n\nMust provide either `showUuid`, `podcastGuid` or `feedUrlBase64`.",
                            "required": false,
                            "type": "string",
                            "format": "32-character hex",
                        },
                        {
                            "name": "feedUrlbase64",
                            "in": "query",
                            "description": "Specify the show by podcast feed url (as [urlsafe base-64](https://www.base64url.com/)).\n\nMust provide either `showUuid`, `podcastGuid` or `feedUrlBase64`.",
                            "required": false,
                            "type": "string",
                            "format": "urlsafe base-64",
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": "successful operation",
                            "schema": {
                                "$ref": "#/definitions/QueryTopAppsForShowResponse"
                            }
                        }
                    },
                    "security": [
                        {
                            "bearer_token_or_token_query_param": []
                        }
                    ]
                }
            },
            "/queries/top-apps": {
                "get": {
                    "tags": [
                        "queries"
                    ],
                    "summary": "Query the top apps across all OP3 shows",
                    "description": `List global app share over the last thirty days.\n\nResults are returned in reverse order (most downloads to fewest).${queryTopAppsDescriptionSuffix}`,
                    "operationId": "queryTopApps",
                    "produces": [
                        "application/json",
                    ],
                    "parameters": [
                        {
                            "name": "token",
                            "in": "query",
                            "description": "Pass your bearer token either: \n - as an authorization header: `Authorization: Bearer mytoken`\n - or using this query param: `?token=mytoken`\n\nSee the [Authentication](#section/Authentication) section above for how to obtain a token.",
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "deviceName",
                            "in": "query",
                            "description": "If specified, constrains the results to a single device (e.g. `Apple iPhone`).\n\nDevice names can be found in the [opawg/user-agents-v2 device list](https://github.com/opawg/user-agents-v2/blob/master/src/devices.json).\n\nBear in mind not all user-agents contain enough info to derive the device, so this may be of limited utility.",
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "userAgent",
                            "in": "query",
                            "description": "If specified, constrains the results to a single device (e.g. `Apple iPhone`) inferred from a given user agent using the [opawg/user-agents-v2 device list](https://github.com/opawg/user-agents-v2/blob/master/src/devices.json).\n\nBear in mind not all user-agents contain enough info to derive the device, so this may be of limited utility.",
                            "required": false,
                            "type": "string",
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": "successful operation",
                            "schema": {
                                "$ref": "#/definitions/QueryTopAppsResponse"
                            }
                        }
                    },
                    "security": [
                        {
                            "bearer_token_or_token_query_param": []
                        }
                    ]
                }
            },
            "/queries/show-download-counts": {
                "get": {
                    "tags": [
                        "queries"
                    ],
                    "summary": "Query monthly/weekly download counts for one or more shows",
                    "description": [
                        `Get number of monthly downloads (last 30 days) and average weekly downloads over the last four weeks.\n\nExcludes bots. Updated daily.\n\n`,
                        `You can pass in one or more OP3 show uuids, and the results in \`showDownloadCounts\` will be keyed by show, with the following data points for each show:\n`,
                        ` - \`monthlyDownloads\` (number): total number of non-bot downloads for the show in the last 30 days\n`,
                        ` - \`days\` (string): 30-character string, each character identifying whether (\`1\`) or not (\`0\`) the show had at least one-bot download in each of the last 30 days (ascending in time), useful in determining how to interpret \`monthlyDownloads\` for new shows\n`,
                        ` - \`weeklyAvgDownloads\` (number): average number of non-bot downloads per week over the last four weeks (or at least the last few full weeks if new to OP3)\n`,
                        ` - \`weeklyDownloads\` ([ number, number, number, number]): non-bot downloads per week over the last four weeks (ascending in time)\n`,
                        ` - \`numWeeks\` (number): number of recent weeks with full data on OP3, denominator used in \`weeklyAvgDownloads\`. Usually \`4\`, but can be less for new shows (e.g. \`1\` if we only have data for the last 10 days)\n`,
                        queryShowDownloadCountsDescriptionSuffix,
                    ].join(''),
                    "operationId": "queryShowDownloadCounts",
                    "produces": [
                        "application/json",
                    ],
                    "parameters": [
                        {
                            "name": "token",
                            "in": "query",
                            "description": "Pass your bearer token either: \n - as an authorization header: `Authorization: Bearer mytoken`\n - or using this query param: `?token=mytoken`\n\nSee the [Authentication](#section/Authentication) section above for how to obtain a token.",
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "showUuid",
                            "in": "query",
                            "description": "Specify one or more shows by OP3 show uuid.",
                            "required": true,
                            "type": "array",
                            "minItems": 1,
                            "uniqueItems": true,
                            "items": {
                                "type": "string",
                                "format": "32-character hex",
                            }
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": "successful operation",
                            "schema": {
                                "$ref": "#/definitions/QueryShowDownloadCountsResponse"
                            }
                        }
                    },
                    "security": [
                        {
                            "bearer_token_or_token_query_param": []
                        }
                    ]
                }
            },
        },
        
        "securityDefinitions": {
            "bearer_token_or_token_query_param": {
                "type": "custom",
                "in": "header",
                "description": "Pass your bearer token either: \n - as an authorization header: `Authorization: Bearer mytoken`\n - or as a query param: `?token=mytoken`",
            }
        },
        "definitions": {
            "QueryHitsResponse": {
                "type": "object",
                "properties": {
                    "rows": {
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/QueryHitsResponse.Hit"
                        },
                        "description": "Hits that match the query"
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of hits in the response"
                    },
                    "queryTime": {
                        "type": "integer",
                        "description": "Query server processing time, in milliseconds"
                    }
                }
            },
            "QueryHitsResponse.Hit": {
                "type": "object",
                "properties": {
                    "time": {
                        "type": "string",
                    },
                    "uuid": {
                        "type": "string",
                    },
                    "hashedIpAddress": {
                        "type": "string",
                    },
                    "method": {
                        "type": "string",
                    },
                    "url": {
                        "type": "string",
                    },
                    "userAgent": {
                        "type": "string"
                    },
                    "referer": {
                        "type": "string",
                    },
                    "range": {
                        "type": "string",
                    },
                    "xpsId": {
                        "type": "string",
                    },
                    "ulid": {
                        "type": "string",
                    },
                    "edgeColo": {
                        "type": "string",
                    },
                    "continent": {
                        "type": "string",
                    },
                    "country": {
                        "type": "string",
                    },
                    "timezone": {
                        "type": "string",
                    },
                    "regionCode": {
                        "type": "string",
                    },
                    "region": {
                        "type": "string",
                    },
                    "metroCode": {
                        "type": "string",
                    },
                },
                "required": [
                    "time", "uuid", "hashedIpAddress", "method", "url", "edgeColo"
                ]
            },
            "QueryDownloadsResponse": {
                "type": "object",
                "properties": {
                    "rows": {
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/QueryDownloadsResponse.Download"
                        },
                        "description": "Download rows that match the query"
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of downloads in the response"
                    },
                    "queryTime": {
                        "type": "integer",
                        "description": "Query server processing time, in milliseconds"
                    },
                    "continuationToken": {
                        "type": "string",
                        "description": "Present if there are more results. Pass this opaque value as the `continationToken` parameter in the next query to see the next page"
                    }
                }
            },
            "QueryDownloadsResponse.Download": {
                "type": "object",
                "properties": {
                    "time": {
                        "type": "string",
                    },
                    "url": {
                        "type": "string",
                    },
                    "audienceId": {
                        "type": "string",
                    },
                    "showUuid": {
                        "type": "string",
                    },
                    "episodeId": {
                        "type": "string",
                    },
                    "hashedIpAddress": {
                        "type": "string",
                    },
                    "agentType": {
                        "type": "string",
                    },
                    "agentName": {
                        "type": "string",
                    },
                    "deviceType": {
                        "type": "string",
                    },
                    "deviceName": {
                        "type": "string",
                    },
                    "referrerType": {
                        "type": "string",
                    },
                    "referrerName": {
                        "type": "string",
                    },
                    "botType": {
                        "type": "string",
                    },
                    "countryCode": {
                        "type": "string",
                    },
                    "continentCode": {
                        "type": "string",
                    },
                    "regionCode": {
                        "type": "string",
                    },
                    "regionName": {
                        "type": "string",
                    },
                    "timezone": {
                        "type": "string",
                    },
                    "metroCode": {
                        "type": "string",
                    },
                   
                },
                "required": [
                    "time", "url", "audienceId", "showUuid", "episodeId", "hashedIpAddress"
                ]
            },
            "ViewShowResponse": {
                "type": "object",
                "properties": {
                    "showUuid": {
                        "type": "string",
                        "description": "Unique OP3 uuid for the show",
                        "format": "32-character hex",
                    },
                    "title": {
                        "type": "string",
                        "description": "Title of the show"
                    },
                    "podcastGuid": {
                        "type": "string",
                        "description": "[\`podcast:guid\`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#guid) associated with the show",
                        "format": "guid",
                    },
                    "statsPageUrl": {
                        "type": "string",
                        "description": "Canonical public stats page url for the show",
                        "format": "url",
                    },
                    "episodes": {
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/ViewShowResponse.Episode"
                        },
                        "description": "If included, all episodes for the show (from newest to oldest)"
                    },
                },
                "required": [
                    "showUuid", "statsPageUrl"
                ]
            },
            "ViewShowResponse.Episode": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "OP3 episode id, unique within the show",
                        "format": "64-character hex",
                    },
                    "title": {
                        "type": "string",
                        "description": "Title of the episode"
                    },
                    "pubdate": {
                        "type": "string",
                        "description": "Publication time of the episode",
                        "format": "ISO 8601 timestamp",
                    },
                },
                "required": [
                    "id"
                ]
            },
            "QueryRecentEpisodesWithTranscriptsResponse": {
                "type": "object",
                "properties": {
                    "asof": {
                        "type": "string",
                        "description": "Data current as of this time, usually the start of the current UTC day",
                        "format": "ISO 8601 timestamp",
                    },
                    "episodes": {
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/QueryRecentEpisodesWithTranscriptsResponse.Episode"
                        },
                        "description": "All episodes using OP3 with a [\`podcast:transcript\`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#transcript) tag, from newest to oldest"
                    },
                    "queryTime": {
                        "type": "integer",
                        "description": "Query server processing time, in milliseconds"
                    }
                },
                "required": [
                    "asof", "episodes", "queryTime"
                ]
            },
            "QueryRecentEpisodesWithTranscriptsResponse.Episode": {
                "type": "object",
                "properties": {
                    "pubdate": {
                        "type": "string",
                        "description": "Publication time of the episode",
                        "format": "ISO 8601 timestamp",
                    },
                    "podcastGuid": {
                        "type": "string",
                        "description": "The [\`podcast:guid\`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#guid) of the associated show",
                    },
                    "episodeItemGuid": {
                        "type": "string",
                        "description": "The episode's item-level `<guid>` tag value",
                    },
                    "hasTranscripts": {
                        "type": "boolean",
                        "description": "Whether or not the episode has a [\`podcast:transcript\`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#transcript) tag (always true for this query)",
                    },
                    "dailyDownloads": {
                        "type": "object",
                        "description": "Number of downloads (object value) per day (object key)",
                        "additionalProperties": true,
                        "format": "{ \"yyyy-mm-dd\": number }"
                    },
                },
                "required": [
                    "pubdate", "podcastGuid", "episodeItemGuid", "hasTranscripts", "dailyDownloads"
                ]
            },
            "QueryTopAppsForShowResponse": {
                "type": "object",
                "properties": {
                    "showUuid": {
                        "type": "string",
                        "description": "OP3 show uuid",
                        "format": "32-character hex",
                    },
                    "appDownloads": {
                        "type": "object",
                        "description": "Total downloads per app over the last three calendar months. Sorted by most to fewest downloads",
                        "additionalProperties": true,
                        "format": "{ \"App Name\": number }"
                    },
                    "queryTime": {
                        "type": "integer",
                        "description": "Query server processing time, in milliseconds"
                    }
                },
                "required": [
                    "showUuid", "appDownloads", "queryTime"
                ]
            },
            "QueryTopAppsResponse": {
                "type": "object",
                "properties": {
                    "appShares": {
                        "type": "object",
                        "description": "Share percentage per app over the last 30 days. Sorted by most to fewest downloads",
                        "additionalProperties": true,
                        "format": "{ \"App Name\": number }"
                    },
                    "deviceName": {
                        "type": "string",
                        "description": "Device name, if filtered to a specific device (e.g. `Apple iPhone`)",
                    },
                    "minDate": {
                        "type": "string",
                        "description": "Oldest utc day in data range",
                    },
                    "maxDate": {
                        "type": "string",
                        "description": "Newest utc day in data range",
                    },
                    "queryTime": {
                        "type": "integer",
                        "description": "Query server processing time, in milliseconds"
                    }
                },
                "required": [
                    "appShares", "minDate", "maxDate", "queryTime"
                ]
            },
            "QueryShowDownloadCountsResponse": {
                "type": "object",
                "properties": {
                    "asof": {
                        "type": "string",
                        "description": "Data current as of this date, usually the most recent fully-complete UTC day",
                        "format": "yyyy-mm-dd",
                    },
                    "showDownloadCounts": {
                        "type": "object",
                        "description": "Monthly and weekly download counts per requested show (keyed by `showUuid`)",
                        "additionalProperties": true,
                        "format": "{ \"showUuid\": { days: string, monthlyDownloads: number, weeklyDownloads: [ number, number, number, number ], weeklyAvgDownloads: number, numWeeks: number } }"
                    },
                    "queryTime": {
                        "type": "integer",
                        "description": "Query server processing time, in milliseconds"
                    }
                },
                "required": [
                    "asof", "showDownloadCounts", "queryTime"
                ]
            },
        }
    }
);
