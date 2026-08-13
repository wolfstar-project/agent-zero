/** Route `@onmax/nuxt-better-auth` sends unauthenticated visitors to. */
export const loginPath = '/login';

/**
 * Sign-in capabilities the login page renders.
 *
 * Imported from `@agent-zero/auth/config` rather than restated here, so the build-time label in
 * `nuxt.config.ts`'s `appConfig` and the runtime enforcement in `server/auth.config.ts` cannot
 * drift. The subpath carries policy only, with none of the database dependencies that
 * `authBetterAuthOptions` needs. Resolving through `authConfigFromEnvironment` keeps the published
 * capabilities in step with `AUTH_ENABLE_SIGNUP` and the GitHub OAuth credentials, and the values
 * are published through `appConfig` so no `NUXT_PUBLIC_*` runtime override can diverge from that
 * single source.
 */
export { authConfigFromEnvironment } from '@agent-zero/auth/config';
