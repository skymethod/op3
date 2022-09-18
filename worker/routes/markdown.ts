import { encodeXml } from '../deps.ts';

export function computeMarkdownHtml(markdown: string): string {
    const regex = /\[(.*?)\]\((.*?)\)/g;
    let m: RegExpExecArray | null;
    const rt: string[] = [];
    let i = 0;
    while ((m = regex.exec(markdown)) !== null) {
        const { lastIndex } = regex;
        const { index } = m;
        const [ _, text, href ] = m;
        rt.push(encodeXml(markdown.substring(i, index)));
        rt.push(`<a href="${href}">${encodeXml(text)}</a>`);
        i = lastIndex;
    }
    rt.push(encodeXml(markdown.substring(i)));
    return rt.join('');
}

export function computeMarkdownText(markdown: string): string {
    const regex = /\[(.*?)\]\((.*?)\)/g;
    let m: RegExpExecArray | null;
    const rt: string[] = [];
    let i = 0;
    while ((m = regex.exec(markdown)) !== null) {
        const { lastIndex } = regex;
        const { index } = m;
        const [ _, text, href ] = m;
        rt.push(markdown.substring(i, index));
        rt.push(`${text} (${href})`);
        i = lastIndex;
    }
    rt.push(markdown.substring(i));
    return rt.join('');
}
