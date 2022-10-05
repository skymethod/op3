import { computeCloudflareAnalyticsSnippet } from './html.ts';

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
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet" />
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url="/api/docs/swagger.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    ${cfAnalyticsSnippet}
  </body>
</html>
`;
