import { Configuration } from '../configuration.ts';
import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet } from './html.ts';
const apiDocsHead = await importText(import.meta.url, '../static/api_docs_head.htm');
const apiDocsHtml = await importText(import.meta.url, '../static/api_docs_html.htm');

export async function computeApiDocsResponse(opts: { instance: string, origin: string, cfAnalyticsToken: string | undefined, previewTokens: Set<string>, configuration: Configuration | undefined }): Promise<Response> {
    const { instance, origin, cfAnalyticsToken, previewTokens, configuration } = opts;
    const titleSuffix = instance === 'prod' ? '' : ` (${instance})`;
    const cfAnalyticsSnippet = computeCloudflareAnalyticsSnippet(cfAnalyticsToken);

    const previewToken = [...previewTokens].at(0);
    const demoShowUuid = await configuration?.get('demo-show-1');

    let finalApiDocsHtml = apiDocsHtml.replaceAll('${ORIGIN}', origin);
    if (previewToken) finalApiDocsHtml = finalApiDocsHtml.replaceAll(/PREVIEW_TOKEN_TEMPLATE/g, previewToken);
    if (demoShowUuid) finalApiDocsHtml = finalApiDocsHtml.replaceAll(/DEMO_SHOW_UUID_TEMPLATE/g, demoShowUuid);

    return new Response(html(origin, titleSuffix, finalApiDocsHtml, cfAnalyticsSnippet), { headers: { 'content-type': 'text/html' } });
}

//

const html = (origin: string, titleSuffix: string, finalApiDocsHtml: string, cfAnalyticsSnippet: string) => `<!DOCTYPE html>
<html>
  <head>
    <title>OP3 API Documentation${titleSuffix}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="${origin}/api/docs" />
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #d4d4d4;
      }
    </style>
    ${apiDocsHead}
  </head>
  <body>
    ${finalApiDocsHtml}
   
    ${cfAnalyticsSnippet}
  </body>
</html>
`;
