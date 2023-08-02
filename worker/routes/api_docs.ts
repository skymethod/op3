import { importText } from '../deps.ts';
import { computeCloudflareAnalyticsSnippet } from './html.ts';
const apiDocsHead = await importText(import.meta.url, '../static/api_docs_head.htm');
const apiDocsHtml = await importText(import.meta.url, '../static/api_docs_html.htm');

export function computeApiDocsResponse(opts: { instance: string, origin: string, cfAnalyticsToken: string | undefined }): Response {
    const { instance, origin, cfAnalyticsToken } = opts;
    const titleSuffix = instance === 'prod' ? '' : ` (${instance})`;
    const cfAnalyticsSnippet = computeCloudflareAnalyticsSnippet(cfAnalyticsToken);
    return new Response(html(origin, titleSuffix, cfAnalyticsSnippet), { headers: { 'content-type': 'text/html' } });
}

//

const html = (origin: string, titleSuffix: string, cfAnalyticsSnippet: string) => `<!DOCTYPE html>
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
    ${apiDocsHtml.replaceAll('${ORIGIN}', origin)}
   
    ${cfAnalyticsSnippet}
  </body>
</html>
`;
