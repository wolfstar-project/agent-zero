import process from 'node:process';

/**
 * Identity and outbound links for the public marketing site.
 *
 * Everything here is static build-time configuration. The site owns no persistence and no
 * credentials, so nothing in this file may ever hold a secret.
 */
export const app = {
  name: 'Agent Zero',
  /** Fallback `<title>` and the suffix `titleTemplate` appends to every page title. */
  title: 'Agent Zero',
} as const satisfies Record<string, string>;

/** Color-mode defaults consumed by `@nuxtjs/color-mode` in `nuxt.config.ts`. */
export const ui = {
  colorModePreference: 'system',
  colorModeFallback: 'dark',
  // Deliberately distinct from the dashboard's key: the two apps are separate origins in
  // production, and sharing a key would only couple them if they were ever proxied under one.
  colorModeStorageKey: 'agent-zero-marketing-color-mode',
} as const satisfies Record<string, string>;

/**
 * Off-site destinations rendered in the header, footer, and calls to action.
 *
 * The dashboard is a separate deployment, so its origin is configuration rather than a route.
 */
export const links = {
  repository: 'https://github.com/RedStarDev/agent-zero',
  issues: 'https://github.com/RedStarDev/agent-zero/issues',
  security: 'https://github.com/RedStarDev/agent-zero/blob/main/SECURITY.md',
  changelog: 'https://github.com/RedStarDev/agent-zero/releases',
  architecture: 'https://github.com/RedStarDev/agent-zero/blob/main/docs/architecture.md',
  docs: 'https://github.com/RedStarDev/agent-zero#readme',
  contactEmail: 'hello@agent-zero.dev',
} as const satisfies Record<string, string>;

/** Default public origin, used when `MARKETING_SITE_URL` is unset (local development). */
export const defaultSiteUrl = 'http://localhost:3001';

/**
 * Public origin the sitemap, canonical URLs, and robots directives are built from.
 *
 * Read from `MARKETING_SITE_URL` rather than `NUXT_PUBLIC_SITE_URL`: the dashboard already claims
 * that variable for the auth adapter's origin, and a shared `.env` would otherwise point this
 * site's canonical URLs at the auth server.
 */
export function siteUrlFromEnvironment(): string {
  return process.env.MARKETING_SITE_URL?.trim() || defaultSiteUrl;
}

/** Dashboard origin the "Sign in" affordance points at. */
export function dashboardUrlFromEnvironment(): string {
  return process.env.MARKETING_DASHBOARD_URL?.trim() || 'http://localhost:3000';
}
