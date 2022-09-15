export function computeHtml(template: string, variables: Record<string, string>) {
    return template.replace(/\${(\w+)}/g, (_, g1) => {
        const value = variables[g1];
        if (value === undefined) throw new Error(`Undefined variable: ${g1}`);
        return value;
    });
}
