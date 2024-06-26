import { assertEquals } from '../tests/deps.ts';
import { computePreferredSupportedLanguage, toUppercaseExceptMarkup } from './strings.ts';

Deno.test({
    name: 'computePreferredSupportedLanguage',
    fn: () => {
        assertEquals(computePreferredSupportedLanguage({ }), undefined);

        assertEquals(computePreferredSupportedLanguage({ langParam: 'en' }), 'en');
        assertEquals(computePreferredSupportedLanguage({ langParam: 'de' }), 'de');
        assertEquals(computePreferredSupportedLanguage({ langParam: 'pl' }), undefined);
        assertEquals(computePreferredSupportedLanguage({ langParam: 'end' }), undefined);
        assertEquals(computePreferredSupportedLanguage({ langParam: 'en-US' }), 'en');
        assertEquals(computePreferredSupportedLanguage({ langParam: 'en-GB' }), 'en-gb');

        const acceptLanguageTests = {
            '': undefined,
            '*': undefined,
            'fr': 'fr',
            ' fr ': 'fr',
            ' FR-FR ': 'fr',
            'en-US,en;q=0.5': 'en',
            'en-AU,en;q=0.5': 'en-gb',
            'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5': 'fr',
        }
        for (const [ acceptLanguage, expected ] of Object.entries(acceptLanguageTests)) {
            assertEquals(computePreferredSupportedLanguage({ acceptLanguage }), expected);
        }

        assertEquals(computePreferredSupportedLanguage({ langParam: 'en', acceptLanguage: 'fr-FR' }), 'en');
        assertEquals(computePreferredSupportedLanguage({ langParam: 'pl', acceptLanguage: 'fr-FR' }), 'fr');
    }
});

Deno.test({
    name: 'toUppercaseExceptMarkup',
    fn: () => {
        const inputToExpected = {
            '': '',
            ' ': ' ',
            '<a>foo</a>': '<a>FOO</a>',
            'foo': 'FOO',
        }
        for (const [ input, expected ] of Object.entries(inputToExpected)) {
            assertEquals(toUppercaseExceptMarkup(input), expected);
        }
    }
});
