import { defineNuxtConfig } from 'nuxt/config';

import { app, ui } from './config/app.js';
import { authConfigFromEnvironment, defaultAuthServerUrl, loginPath } from './config/auth.js';
import { defaultLocale, i18nLocales, localeCookieName } from './config/i18n.js';

// Resolved once at config evaluation so the dashboard publishes the same sign-in policy the auth
// server derives from the shared environment (AUTH_ENABLE_SIGNUP, GitHub OAuth credentials).
const authPolicy = authConfigFromEnvironment();

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
        preference: ui.colorModePreference,
        fallback: ui.colorModeFallback,
        dataValue: 'theme',
        storageKey: ui.colorModeStorageKey,
      },
    ],
  ],
  css: ['~/assets/css/main.css'],
  i18n: {
    locales: i18nLocales,
    defaultLocale,
    // The dashboard is a single internal surface, so localised URL prefixes would only churn
    // route paths without buying any of the SEO they exist for.
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: localeCookieName,
      alwaysRedirect: false,
      fallbackLocale: defaultLocale,
    },
  },
  auth: {
    // Better Auth runs in `apps/auth-server`, not here. Client-only mode drops the local
    // `/api/auth/**` handlers, the server config, and the signing secret, which is what keeps the
    // dashboard free of Nitro auth routes and of any persistence.
    clientOnly: true,
    redirects: {
      login: loginPath,
      guest: '/',
      authenticated: '/',
      logout: loginPath,
    },
  },
  runtimeConfig: {
    public: {
      // In client-only mode the module reads this as the Better Auth client base URL, so it points
      // at the auth adapter rather than at the dashboard. Override with NUXT_PUBLIC_SITE_URL.
      siteUrl: defaultAuthServerUrl,
    },
  },
  // Published through appConfig rather than runtimeConfig.public: Nuxt maps NUXT_PUBLIC_* env vars
  // onto public runtime keys, which would let a deployment advertise a sign-in capability that
  // diverges from the policy the auth server derives from the same environment. appConfig has no
  // env override channel, so AUTH_ENABLE_SIGNUP and the GitHub OAuth credentials stay the single
  // authoritative source for both processes.
  appConfig: {
    auth: {
      enableSignup: authPolicy.enableSignup,
      enableGithubOauth: authPolicy.enableGithubOauth,
    },
  },
  app: {
    head: {
      meta: [{ name: 'color-scheme', content: 'dark light' }],
      title: app.title,
    },
  },
  routeRules: {
    '/': { appLayout: 'default', auth: { only: 'user' } },
    [loginPath]: { auth: { only: 'guest' } },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
});
