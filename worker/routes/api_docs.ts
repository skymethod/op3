export function computeApiDocsResponse(opts: { instance: string }): Response {
    const { instance } = opts;
    const titleSuffix = instance === 'prod' ? '' : ` (${instance})`;
    return new Response(html(titleSuffix), { headers: { 'content-type': 'text/html' } });
}

//

const html = (titleSuffix: string) => `<!DOCTYPE html>
<html>
  <head>
    <title>OP3 API Documentation${titleSuffix}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
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
  </body>
</html>
`;
