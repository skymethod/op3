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
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #d4d4d4;
      }
    </style>
  </head>
  <body>
    <div id="redoc-container"></div>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script>
      Redoc.init('/api/docs/swagger.json', {
        theme: {
          rightPanel: {
            backgroundColor: '#171717',
          },
          sidebar: {
            backgroundColor: '#171717',
            textColor: '#d4d4d4',
            activeTextColor: '#ea580c',
          },
          colors: {
            primary: {
              main: '#c2410c', // links
            },
          },
          typography: {
            code: {
              color: '#ea580c',
            }
          }

        }
      }, document.getElementById('redoc-container'));
    </script>
    ${cfAnalyticsSnippet}
  </body>
</html>
`;
