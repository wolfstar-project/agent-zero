/** Route `@onmax/nuxt-better-auth` sends unauthenticated visitors to. */
export const loginPath = '/login';

/** Fallback for `NUXT_PUBLIC_SITE_URL`, matching the auth server's default port. */
export const defaultAuthServerUrl = 'http://localhost:3001';

/**
 * Sign-in capabilities the login page renders.
 *
 * Imported from `@agent-zero/auth/config` rather than restated here, so the dashboard and the auth
 * server cannot drift. The subpath carries policy only, with none of the server's database
 * dependencies. Resolving through `authConfigFromEnvironment` keeps the published capabilities in
 * step with the auth server's policy (`AUTH_ENABLE_SIGNUP`, GitHub OAuth credentials); both
 * processes read the same environment, and the values are published through `appConfig` so no
 * `NUXT_PUBLIC_*` runtime override can diverge from that single source.
 */
export { authConfigFromEnvironment } from '@agent-zero/auth/config';
