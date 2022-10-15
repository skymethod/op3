import { assertEquals, assert } from './tests/deps.ts';
import { computeSessionToken, validateSessionToken } from './session_token.ts';

Deno.test({
    name: 'session_token',
    fn: async () => {
        const claims = { foo: 'bar' };
        const sessionToken = await computeSessionToken(claims, 'secret');
        assert(!sessionToken.includes('secret'));

        const actualClaims = await validateSessionToken(sessionToken, 'secret');
        assertEquals(actualClaims, claims);
    }
});
