import { defineClientAuth } from '@onmax/nuxt-better-auth/config';
import { organizationClient } from 'better-auth/client/plugins';

// Better Auth runs in `apps/auth-server`, on its own origin, so in client-only mode `siteUrl`
// resolves to the auth adapter rather than to this app. Every call is therefore cross-origin: the
// adapter has to allow credentialed CORS and list the dashboard in its `trustedOrigins`.
export default defineClientAuth((ctx) => ({
  baseURL: ctx.siteUrl,
  fetchOptions: { credentials: 'include' },
  // Registered unconditionally: the client plugin only adds callable methods, and whether the
  // deployment actually serves them is decided by the auth server's own policy. Gating it on a
  // build-time flag would let a stale dashboard build lose access to an enabled feature.
  plugins: [organizationClient()],
}));
