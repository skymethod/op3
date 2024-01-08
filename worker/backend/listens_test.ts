import { assertEquals } from '../tests/deps.ts';
import { generateUuid } from '../uuid.ts';
import { ShowListenStats, isValidShowListenStats, isValidUnpackedMinuteMap, packMinuteMap, unpackMinuteMap } from './listens.ts';

Deno.test({
    name: 'minuteMaps',
    fn: () => {
        const good: number[][] = [
            [ 0 ],
            [ 1, 1 ],
        ];
        for (const minuteMap of good) {
            assertEquals(isValidUnpackedMinuteMap(minuteMap), true);
            const packed = packMinuteMap(minuteMap);
            assertEquals(unpackMinuteMap(packed), minuteMap);
        }

        const bad: number[][] = [
            [ ],
            [ -1 ],
        ];
        for (const minuteMap of bad) {
            assertEquals(isValidUnpackedMinuteMap(minuteMap), false);
        }

        assertEquals(packMinuteMap([0]), '0');
        assertEquals(packMinuteMap([1, 1, 1, 0, 1]), '11101');
    }
});

Deno.test({
    name: 'ShowListenStats',
    fn: () => {
        const stats: ShowListenStats = { showUuid: generateUuid(), episodeListenStats: Object.fromEntries([{ itemGuid: generateUuid(), minuteMaps: [] }].map(v => [ v.itemGuid, v ])) };
        assertEquals(isValidShowListenStats(stats), true);
    }
});
