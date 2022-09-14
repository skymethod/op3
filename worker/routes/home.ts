export function computeHomeResponse(opts: { instance: string }): Response {
    const { instance } = opts;
    return new Response(`👋 from ${instance}`);
}
