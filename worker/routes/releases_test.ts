import { assertEquals } from 'https://deno.land/std@0.155.0/testing/asserts.ts';
import { computeMarkdownHtml, computeRfc822 } from './releases.ts';

Deno.test({
    name: 'computeRfc822',
    fn: () => {
        assertEquals(computeRfc822('2022-09-18T16:18:54.780Z'), 'Sun, 18 Sep 2022 16:18:54 GMT');
    }
});

Deno.test({
    name: 'computeMarkdownHtml',
    fn: () => {
        assertEquals(computeMarkdownHtml('one[link](https://example.com)two[link2](https://example.com/2)three'), 'one<a href="https://example.com">link</a>two<a href="https://example.com/2">link2</a>three');
    }
});
