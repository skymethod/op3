import { QUERY_REDIRECT_LOGS } from './api_contract.ts';
import { computeNonProdWarning } from './instances.ts';

export function computeApiDocsSwaggerResponse(opts: { instance: string, origin: string, previewTokens: Set<string> }): Response {
    const { instance, origin, previewTokens } = opts;
    const { host } = new URL(origin);

    const versionSuffix = instance === 'prod' ? '' : `-${instance}`;
    let descriptionSuffix = `\n\n# Endpoint\n\nBase url for all API calls: \`${origin}/api/1\`\n\n# Authentication\n\nEvery call to the OP3 API requires a bearer token associated with a valid API Key.\n\n> [Manage your API Keys and bearer tokens →](/api/keys)\n\nPass your bearer token either: \n - as an authorization header: \`Authorization: Bearer mytoken\`\n - or using this query param: \`?token=mytoken\`\n\n`;
    let queryRedirectLogsDescriptionSuffix = '';
    const previewToken = [...previewTokens].at(0);
    if (previewToken) {
        descriptionSuffix += `\n\nYou can also use the sample bearer token \`${previewToken}\` to preview API access on this instance.`;
        const exampleApiCall = `${origin}/api/1/redirect-logs?start=-24h&format=json&token=${previewToken}`;
        queryRedirectLogsDescriptionSuffix = `\n\nFor example, to view logs starting 24 hours ago in json format:\n\n\GET [${exampleApiCall}](${exampleApiCall})`;
    }

    const nonProdWarning = computeNonProdWarning(instance);
    if (nonProdWarning) descriptionSuffix += `\n\n# This is not production!\n\n**${nonProdWarning}**`;

    const swagger = computeSwagger(origin, host, versionSuffix, descriptionSuffix, queryRedirectLogsDescriptionSuffix);
    return new Response(JSON.stringify(swagger, undefined, 2), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

//

const computeSwagger = (origin: string, host: string, versionSuffix: string, descriptionSuffix: string, queryRedirectLogsDescriptionSuffix: string) => (
    {
        "swagger": "2.0",
        "info": {
            "description": `The [Open Podcast Prefix Project](${origin}) is an open-source [podcast prefix analytics service](https://soundsprofitable.com/update/prefix-analytics) committed to open data and listener privacy.\n\nThis API serves as an interface to access the data collected in a privacy-preserving way.${descriptionSuffix}`,
            "version": `0.0.1${versionSuffix}`,
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
                "name": "redirect-logs",
                "description": "Lowest-level log records saved for every prefix redirect processed.\n\nThis is the raw material on which higher-level metrics like downloads can be later derived.",

            },
        ],
        "schemes": [
            "https",
        ],
        "paths": {
            "/redirect-logs": {
                "get": {
                    "tags": [
                        "redirect-logs"
                    ],
                    "summary": "Query redirect logs",
                    "description": `Perform a query of every request logged using the redirect.\n\nThis can be used to verify that requests are stored properly in the system.\n\nResults are returned in ascending order by time (plus uuid to break ties for multiple requests in the same millisecond).\n\nYou can filter by a time range and one additional optional dimension (such as \`url\`).${queryRedirectLogsDescriptionSuffix}`,
                    "operationId": "queryRedirectLogs",
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
                            "maximum": QUERY_REDIRECT_LOGS.limitMax,
                            "minimum": QUERY_REDIRECT_LOGS.limitMin,
                            "default": QUERY_REDIRECT_LOGS.limitDefault,
                        },
                        {
                            "name": "start",
                            "in": "query",
                            "description": "Filter by start time (inclusive) using a timestamp or relative time (e.g. `-24h`)\n\nYou can specify either `start` or `startAfter`, not both",
                            "example": "2022-09-15T14:00:52.709Z",
                            "required": false,
                            "type": "string",
                            "format": "ISO 8601 or relative duration",
                        },
                        {
                            "name": "startAfter",
                            "in": "query",
                            "description": "Filter by start time (exclusive) using a timestamp or relative time (e.g. `-24h`)\n\nYou can specify either `start` or `startAfter`, not both",
                            "example": "2022-09-15T14:00:52.709Z",
                            "required": false,
                            "type": "string",
                            "format": "ISO 8601 or relative duration",
                        },
                        {
                            "name": "end",
                            "in": "query",
                            "description": "Filter by end time (exclusive) using a timestamp or relative time (e.g. `-24h`)",
                            "example": "2022-09-15T14:00:52.709Z",
                            "required": false,
                            "type": "string",
                            "format": "ISO 8601 or relative duration",
                        },
                        {
                            "name": "url",
                            "in": "query",
                            "description": `Filter by a specific episode url\n\nYou can specify either \`url\` or \`urlSha256\`, not both\n\n**[New]** Supports trailing wildcards, i.e. "starts with"\n\nExample: \`url=${origin}/e/example.com/path/to/*\``,
                            "example": `${origin}/e/example.com/path/to/episode.mp3`,
                            "required": false,
                            "type": "string",
                            "format": "url",
                        },
                        {
                            "name": "urlSha256",
                            "in": "query",
                            "description": "Filter by the SHA-256 hash of a specific episode url\n\nYou can specify either `url` or `urlSha256`, not both",
                            "example": `b72a551aa68b46480c9cc461387598b57db3c234ebec0dea062b230ab0032749`,
                            "required": false,
                            "type": "string",
                            "format": "64-character hex",
                        },
                        {
                            "name": "userAgent",
                            "in": "query",
                            "description": "Filter by a specific User-Agent header",
                            "example": `AppleCoreMedia/1.0.0.19G82 (iPhone; U; CPU OS 15_6_1 like Mac OS X; en_gb)`,
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "referer",
                            "in": "query",
                            "description": "Filter by a specific Referer header\n\n(intentionally follows the misspelling of the header name in the HTTP spec)",
                            "example": `https://www.jam.ai/`,
                            "required": false,
                            "type": "string",
                        },
                        {
                            "name": "hashedIpAddress",
                            "in": "query",
                            "description": "Filter by a specific IP address secure hash\n\nRaw IP addresses are never stored, only their secure hash, using rotating keys",
                            "example": `a3f1b92bc53ff9512253be45bc9c60047bddad55`,
                            "required": false,
                            "type": "40-character hex",
                        },
                        {
                            "name": "edgeColo",
                            "in": "query",
                            "description": "Filter by a specific CDN edge colo",
                            "example": `DFW`,
                            "required": false,
                        },
                        {
                            "name": "ulid",
                            "in": "query",
                            "description": "Filter by a specific ULID\n\nLearn more about ULIDs at [podcastlistening.com](https://podcastlistening.com/)",
                            "example": `43b811dc-3697-4361-85ef-489bf9bf2deb`,
                            "required": false,
                        },
                        {
                            "name": "method",
                            "in": "query",
                            "description": "Filter by a specific non-GET method\n\nThe vast majority of logs are GET requests, this can target any outliers",
                            "example": `POST`,
                            "required": false,
                            "format": "http method",
                        },
                        {
                            "name": "uuid",
                            "in": "query",
                            "description": "Filter to a single log request (find by id)\n\nEach redirect request is given a private, globally-unique identifier at the edge colo to serve as the primary key of this table",
                            "example": `d20ddd1f239848c9b9aaa4095864b969`,
                            "required": false,
                            "format": "32-character hex",
                        },

                    ],
                    "responses": {
                        "200": {
                            "description": "successful operation",
                            "schema": {
                                "$ref": "#/definitions/QueryRedirectLogsResponse"
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
            "QueryRedirectLogsResponse": {
                "type": "object",
                "properties": {
                    "rows": {
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/LogRow"
                        }
                    },
                }
            },
            "LogRow": {
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
        }
    }
);
