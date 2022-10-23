import { assertEquals, assertNotEquals } from '../tests/deps.ts';
import { trimRecordToFit } from './show_controller_notifications.ts';

Deno.test({
    name: 'trimRecordToFit',
    fn: () => {
        {
            const feed = { items: [ 
                {
                    enclosureUrls: [ 'https://example.com/a '],
                    alternateEnclosureUris: [],
                },
                {
                    enclosureUrls: [ 'https://op3.dev/e/example.com/a'],
                    alternateEnclosureUris: [],
                },
            ]};
            const trimmed = trimRecordToFit({ sent: new Date().toISOString(), received: new Date().toISOString(), sender: 'asdf', feed });

            assertEquals(trimmed.feed.items, [{ enclosureUrls: ['https://op3.dev/e/example.com/a'] }]);
        }

        {
            const items = [];
            for (let i = 0; i < 10000; i++) {
                items.push({ enclosureUrls: [ 'https://op3.dev/e/example.com/a' ], alternateEnclosureUris: [],})
            }
            const trimmed = trimRecordToFit({ sent: new Date().toISOString(), received: new Date().toISOString(), sender: 'asdf', feed: { items } });

            // deno-lint-ignore no-explicit-any
            assertNotEquals((trimmed as any).feed.items.length, 1000);
        }
    }
});
