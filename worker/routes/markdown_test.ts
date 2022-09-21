import { assertEquals } from '../tests/deps.ts';
import { computeMarkdownHtml } from './markdown.ts';

Deno.test({
    name: 'computeMarkdownHtml',
    fn: () => {
        assertEquals(computeMarkdownHtml('one[link](https://example.com)two[link2](https://example.com/2)three'), 'one<a href="https://example.com">link</a>two<a href="https://example.com/2">link2</a>three');
    }
});
