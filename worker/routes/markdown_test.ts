import { assertEquals } from '../tests/deps.ts';
import { computeMarkdownHtml, computeMarkdownText } from './markdown.ts';

Deno.test({
    name: 'computeMarkdownHtml',
    fn: () => {
        assertEquals(computeMarkdownHtml('one[link](https://example.com)two[link2](https://example.com/2)three'), 'one<a href="https://example.com">link</a>two<a href="https://example.com/2">link2</a>three');
        assertEquals(computeMarkdownHtml('one **bold** thing'), 'one <b>bold</b> thing');
        assertEquals(computeMarkdownHtml('one _italic_ thing'), 'one <i>italic</i> thing');
        assertEquals(computeMarkdownHtml(`[yyyy-mm-dd]: one [two](https://three)`), '[yyyy-mm-dd]: one <a href="https://three">two</a>');
    }
});

Deno.test({
    name: 'computeMarkdownText',
    fn: () => {
        assertEquals(computeMarkdownText('one[link](https://example.com)two[link2](https://example.com/2)three'), 'onelink (https://example.com)twolink2 (https://example.com/2)three');
        assertEquals(computeMarkdownText('one **bold** thing'), 'one **bold** thing');
        assertEquals(computeMarkdownText('one _italic_ thing'), 'one _italic_ thing');
        assertEquals(computeMarkdownText(`[yyyy-mm-dd]: one [two](https://three)`), '[yyyy-mm-dd]: one two (https://three)');
    }
});

