import { QUERY_REDIRECT_LOGS } from './api_contract.ts';

export function computeApiDocsSwaggerResponse(opts: { origin: string, previewTokens: Set<string> }): Response {
    const { origin, previewTokens } = opts;
    const { host } = new URL(origin);
    let descriptionMarkdown =  "This is the description of the service.";
    const previewToken = [...previewTokens].at(0);
    if (previewToken) {
        descriptionMarkdown += ` You can use the bearer token \`${previewToken}\` to preview api calls on this instance.`;
    }
    const swagger = computeSwagger(host, descriptionMarkdown);
    return new Response(JSON.stringify(swagger, undefined, 2), { headers: { 'content-type': 'application/json' } });
}

//

const computeSwagger = (host: string, descriptionMarkdown: string) => (
    {
        "swagger": "2.0",
        "info": {
            "description": descriptionMarkdown,
            "version": "0.0.1",
            "title": "OP3 API",
            "termsOfService": "https://op3.dev/terms/",
            "contact": {
                "email": "apiteam@op3.dev"
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
                "description": "Lowest-level logs of every redirect processed",
                "externalDocs": {
                    "description": "Find out more",
                    "url": "https://op3.dev"
                }
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
                    "summary": "queries the logs",
                    "description": "here is a description",
                    "operationId": "queryRedirectLogs",
                    "produces": [
                        "application/json",
                        "text/tab-separated-values"
                    ],
                    "parameters": [
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
                    "uuid": {
                        "type": "string",
                    },
                },
            },
        },
        "externalDocs": {
            "description": "Find out more about OP3",
            "url": "https://op3.dev"
        }
    }
);
