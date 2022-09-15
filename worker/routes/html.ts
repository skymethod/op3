export function computeHtml(template: string, variables: Record<string, string>) {
    return template.replace(/\${(\w+)}/g, (_, g1) => {
        const value = variables[g1];
        if (value === undefined) throw new Error(`Undefined variable: ${g1}`);
        return value;
    });
}

export function removeHeader(html: string) {
    return html.replace(/<header.*?<\/header>/s, '');
}

export function computeCloudflareAnalyticsSnippet(cfAnalyticsToken: string | undefined) {
    return cfAnalyticsToken ? `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${cfAnalyticsToken}"}'></script><!-- End Cloudflare Web Analytics -->` : '';
}
