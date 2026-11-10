import { assert } from '../tests/deps.ts';
import { isValidPodcastGuid } from './show_controller.ts';

Deno.test({
    name: 'isValidPodcastGuid',
    fn: () => {
        [
            '3F4748B6-1BDA-4765-9C7D-7171DDAF10E4',
            '3f4748b6-1bda-4765-9c7d-7171ddaf10e4',
            '0x1bECc6153CBdF5654357E5AAc813D5f1a45c40a6',
        ]
        .forEach(v => assert(isValidPodcastGuid(v)));

        [
            '3F4748B6-1BDA-4765-9C7D-7171DDAF10E4D',
            '3f4748b6-1bda-4765-zc7d-7171ddaf10e4',
            '0x1bECc6153CBdF565357E5AAc813D5f1a45c40a6',
            '',
            'foo',
            '123',
        ]
        .forEach(v => assert(!isValidPodcastGuid(v)));
    }
});
