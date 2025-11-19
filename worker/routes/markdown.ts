import { encodeXml } from '../deps.ts';

export function computeMarkdownHtml(markdown: string): string {
    const regex = /\[([^\]\[]+)\]\((.*?)\)/g;
    let m: RegExpExecArray | null;
    const parts: string[] = [];
    let i = 0;
    while ((m = regex.exec(markdown)) !== null) {
        const { lastIndex } = regex;
        const { index } = m;
        const [ _, text, href ] = m;
        parts.push(encodeXml(markdown.substring(i, index)));
        parts.push(`<a href="${href}">${encodeXml(text)}</a>`);
        i = lastIndex;
    }
    parts.push(encodeXml(markdown.substring(i)));
    return parts.join('')
        .replaceAll(/`([a-z]+)`/g, `<code>$1</code>`)
        .replaceAll(/\*\*([^*]+?)\*\*/g, `<b>$1</b>`)
        .replaceAll(/_([^_]+?)_/g, `<i>$1</i>`)
        ;
}

export function computeMarkdownText(markdown: string): string {
    const regex = /\[([^\]\[]+)\]\((.*?)\)/g;
    let m: RegExpExecArray | null;
    const parts: string[] = [];
    let i = 0;
    while ((m = regex.exec(markdown)) !== null) {
        const { lastIndex } = regex;
        const { index } = m;
        const [ _, text, href ] = m;
        parts.push(markdown.substring(i, index));
        parts.push(`${text} (${href})`);
        i = lastIndex;
    }
    parts.push(markdown.substring(i));
    return parts.join('')
        .replaceAll(/`([a-z]+)`/g, `$1`)
        // leave the md bold/italics in
        ;
}
