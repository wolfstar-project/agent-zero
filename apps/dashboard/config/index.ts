/**
 * Single source of truth for values that would otherwise be scattered across `nuxt.config.ts`,
 * component templates, and translation files.
 *
 * The dashboard is an operational interface rather than a public site, so everything here is
 * static build-time configuration. Secrets and deployment-specific endpoints belong in
 * `runtimeConfig`, never in this file.
 */

/** Presentation metadata for a locale the dashboard ships translations for. */
export interface LocaleDefinition {
  /** Name of the language, written in that language, for the locale switcher. */
  readonly label: string;
  /** BCP 47 tag used for `<html lang>` and date formatting. */
  readonly language: string;
}

export const locales = {
  en: { label: 'English', language: 'en-US' },
  it: { label: 'Italiano', language: 'it-IT' },
} as const satisfies Record<string, LocaleDefinition>;

/** Locale codes the dashboard can render. */
export type LocaleCode = keyof typeof locales;

export const config = {
  app: {
    name: 'Agent Zero',
    title: 'Agent Zero · Dashboard',
    description:
      'Operational dashboard for Agent Zero, the open-source autonomous engineer that finds, fixes, and verifies problems in pull requests.',
  },
  i18n: {
    locales,
    defaultLocale: 'en',
    cookieName: 'agent-zero-locale',
  },
  ui: {
    colorModePreference: 'system',
    colorModeFallback: 'dark',
    colorModeStorageKey: 'agent-zero-color-mode',
  },
  auth: {
    /** Route `@onmax/nuxt-better-auth` sends unauthenticated visitors to. */
    loginPath: '/login',
    /** Fallback for `NUXT_PUBLIC_SITE_URL`, matching the auth server's default port. */
    defaultServerUrl: 'http://localhost:3001',
  },
} as const satisfies {
  app: Record<string, string>;
  i18n: {
    locales: Record<LocaleCode, LocaleDefinition>;
    defaultLocale: LocaleCode;
    cookieName: string;
  };
  ui: Record<string, string>;
  auth: Record<string, string>;
};

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
