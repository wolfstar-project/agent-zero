import { defineNuxtConfig } from 'nuxt/config';

import { authConfigFromEnvironment, config, locales } from './config/index.js';

// Resolved once at config evaluation so the dashboard publishes the same sign-in policy the auth
// server derives from the shared environment (AUTH_ENABLE_SIGNUP, GitHub OAuth credentials).
const authPolicy = authConfigFromEnvironment();

/**
 * `@nuxtjs/i18n` wants a flat array, while the dashboard configuration keeps locales keyed by code
 * so the switcher and the head metadata can look one up directly.
 *
 * Translations are split by scope rather than kept in one file per locale, which is also the unit
 * Lunaria reports progress on.
 */
const i18nLocales = Object.entries(locales).map(([code, definition]) => ({
  code,
  language: definition.language,
  name: definition.label,
  files: [`${code}/common.json`, `${code}/dashboard.json`, `${code}/auth.json`],
}));

export default defineNuxtConfig({
  compatibilityDate: '2026-08-09',
  devtools: { enabled: false },
  // Rendered as a single-page app. The session cookie belongs to the auth adapter's origin, so a
  // server render can never see it: SSR would resolve every visitor as signed out, redirect to
  // /login, and then be corrected by the client, flashing the login page and mismatching on every
  // hydration. An internal console that is explicitly noindex gains nothing from SSR in exchange.
  ssr: false,
  future: {
    compatibilityVersion: 5,
  },
  modules: [
    '@unocss/nuxt',
    '@nuxtjs/i18n',
    '@onmax/nuxt-better-auth',
    [
      '@nuxtjs/color-mode',
      {
        preference: config.ui.colorModePreference,
        fallback: config.ui.colorModeFallback,
        dataValue: 'theme',
        storageKey: config.ui.colorModeStorageKey,
      },
    ],
  ],
  css: ['~/assets/css/main.css'],
  i18n: {
    locales: i18nLocales,
    defaultLocale: config.i18n.defaultLocale,
    // The dashboard is a single internal surface, so localised URL prefixes would only churn
    // route paths without buying any of the SEO they exist for.
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: config.i18n.cookieName,
      alwaysRedirect: false,
      fallbackLocale: config.i18n.defaultLocale,
    },
  },
  auth: {
    // Better Auth runs in `apps/auth-server`, not here. Client-only mode drops the local
    // `/api/auth/**` handlers, the server config, and the signing secret, which is what keeps the
    // dashboard free of Nitro auth routes and of any persistence.
    clientOnly: true,
    redirects: {
      login: config.auth.loginPath,
      guest: '/',
      authenticated: '/',
      logout: config.auth.loginPath,
    },
  },
  runtimeConfig: {
    public: {
      // In client-only mode the module reads this as the Better Auth client base URL, so it points
      // at the auth adapter rather than at the dashboard. Override with NUXT_PUBLIC_SITE_URL.
      siteUrl: config.auth.defaultServerUrl,
      authEnableSignup: authPolicy.enableSignup,
      authEnableGithubOauth: authPolicy.enableGithubOauth,
    },
  },
  app: {
    head: {
      meta: [{ name: 'color-scheme', content: 'dark light' }],
      title: config.app.title,
    },
  },
  routeRules: {
    '/': { appLayout: 'default', auth: { only: 'user' } },
    [config.auth.loginPath]: { auth: { only: 'guest' } },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
});
