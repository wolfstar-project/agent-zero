/**
 * Presentation and identity metadata for the dashboard shell.
 *
 * The dashboard is an operational interface rather than a public site, so everything here is
 * static build-time configuration. Secrets and deployment-specific endpoints belong in
 * `runtimeConfig`, never in this file.
 */
export const app = {
  name: 'Agent Zero',
  title: 'Agent Zero · Dashboard',
  description:
    'Operational dashboard for Agent Zero, the open-source autonomous engineer that finds, fixes, and verifies problems in pull requests.',
} as const satisfies Record<string, string>;

/** Route `@onmax/nuxt-better-auth` sends unauthenticated visitors to. */
export const loginPath = '/login';

/** Registration route. Separate from `loginPath` so each flow has one URL to link to and gate. */
export const signupPath = '/signup';

/** Color-mode defaults consumed by `@nuxtjs/color-mode` in `nuxt.config.ts`. */
export const ui = {
  colorModePreference: 'system',
  colorModeFallback: 'dark',
  colorModeStorageKey: 'agent-zero-color-mode',
} as const satisfies Record<string, string>;
