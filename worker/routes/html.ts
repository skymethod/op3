export function computeHtml(template: string, variables: Record<string, string | boolean>) {

    template = template.replace(/\${if (\w+)}(.*?)\${endif}/gs, (_, g1, g2) => {
        const value = variables[g1];
        if (value === undefined) throw new Error(`Undefined variable: ${g1}`);
        if (typeof value !== 'boolean') throw new Error(`Expected boolean condition: ${g1}`);
        return value ? g2 : '';
    });

    return template.replace(/\${(\w+)}/g, (_, g1) => {
        const value = variables[g1];
        if (value === undefined) throw new Error(`Undefined variable: ${g1}`);
        if (typeof value === 'boolean') return `${value}`;
        return value;
    });
}

export function removeHeader(html: string) {
    return html.replace(/<header.*?<\/header>/s, '');
}

export function computeCloudflareAnalyticsSnippet(cfAnalyticsToken: string | undefined) {
    return cfAnalyticsToken ? `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${cfAnalyticsToken}"}'></script><!-- End Cloudflare Web Analytics -->` : '';
}
