import { authBetterAuthOptions, authDatabaseOptionsFromEnvironment } from '@agent-zero/auth';
import { defineServerAuth } from '@onmax/nuxt-better-auth/config';

/**
 * Better Auth's database, policy, and provider configuration.
 *
 * `secret` and `baseURL` are deliberately absent from `authBetterAuthOptions`: the module injects
 * them itself (from `NUXT_BETTER_AUTH_SECRET`/`BETTER_AUTH_SECRET` and the resolved site URL), so
 * this file cannot become a second, divergent source for either.
 */
export default defineServerAuth(authBetterAuthOptions(authDatabaseOptionsFromEnvironment()));
