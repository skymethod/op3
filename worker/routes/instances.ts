export function computeNonProdWarning(instance: string): string | undefined {
    return instance === 'ci' ? `CI INSTANCE: This instance is redeployed on every codebase change!`
    : instance === 'dev' ? `DEV INSTANCE: This instance is used for testing and staging production-candidate releases`
    : instance !== 'prod' ? `NON-PRODUCTION INSTANCE: This instance is a non-production version, and may be redeployed often for testing`
    : undefined;
}
