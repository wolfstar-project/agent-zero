import { authBetterAuthOptions, authDatabaseOptionsFromEnvironment } from '@agent-zero/auth';
import { defineServerAuth } from '@onmax/nuxt-better-auth/config';
import { memoryAdapter } from 'better-auth/adapters/memory';

/**
 * Better Auth's database, policy, and provider configuration.
 *
 * `secret` and `baseURL` are deliberately absent from `authBetterAuthOptions`: the module injects
 * them itself (from `NUXT_BETTER_AUTH_SECRET`/`BETTER_AUTH_SECRET` and the resolved site URL), so
 * this file cannot become a second, divergent source for either.
 */
const options = authBetterAuthOptions(authDatabaseOptionsFromEnvironment());

/**
 * `AUTH_E2E_MEMORY` swaps the Postgres adapter for an in-memory one. Set only by the Playwright
 * preview server (`start:playwright:webserver`, see `playwright.config.ts`), so the e2e suite in
 * `test/e2e/test-utils.ts` can sign up and sign in its own throwaway account through the real
 * `/api/auth/**` endpoints without a live database, staying off the network and off mutable
 * external state. `AUTH_DATABASE_URL` still has to resolve to build `options` above, but nothing
 * ever queries it once `database` is overridden here.
 */
export default defineServerAuth(
  process.env.AUTH_E2E_MEMORY === 'true'
    ? {
        ...options,
        // Better Auth's memory adapter needs each model's collection to exist up front, even
        // empty — an absent key throws "Model <name> not found" on the first query rather than
        // being treated as an empty table.
        database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
        // The default rate limiter can't determine a per-client IP in this sandboxed preview
        // server, so it falls back to one shared bucket across every request. A parallel
        // Playwright run's repeated sign-up/sign-in calls exhaust that bucket in a few tests;
        // rate limiting isn't what this suite exercises, so it's off for this adapter only.
        rateLimit: { enabled: false },
      }
    : options,
);
