import { defineClientAuth } from '@onmax/nuxt-better-auth/config';

// Better Auth runs in `apps/auth-server`, on its own origin, so in client-only mode `siteUrl`
// resolves to the auth adapter rather than to this app. Every call is therefore cross-origin: the
// adapter has to allow credentialed CORS and list the dashboard in its `trustedOrigins`.
export default defineClientAuth((ctx) => ({
  baseURL: ctx.siteUrl,
  fetchOptions: { credentials: 'include' },
}));
