import { betterEnrollmentClient } from '@octopi-ai/better-enrollment/client';
import { defineClientAuth } from '@onmax/nuxt-better-auth/config';
import { organizationClient } from 'better-auth/client/plugins';

// Better Auth is mounted in this app's own server (`server/auth.config.ts`), so every request is
// same-origin: no explicit `baseURL` or credentialed CORS is needed.
//
// Both plugins are passed exactly as their factories return them. Better Auth infers the whole
// client API from this list in one pass, reading each plugin's `$InferServerPlugin`, so widening
// one entry — by intersecting it with the base `BetterAuthClientPlugin` interface, for instance —
// costs the *other* plugin its inferred endpoints: `organization.list`, `organization.inviteMember`
// and the rest stop existing on the client's type.
export default defineClientAuth({
  // Registered unconditionally: the client plugin only adds callable methods, and whether the
  // deployment actually serves them is decided by the auth server's own policy. Gating it on a
  // build-time flag would let a stale dashboard build lose access to an enabled feature.
  plugins: [organizationClient(), betterEnrollmentClient()],
});
