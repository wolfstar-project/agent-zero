import { defineNuxtConfig } from 'nuxt/config';

import { app, ui } from './config/app.js';
import { authConfigFromEnvironment, loginPath } from './config/auth.js';
import { stripEmptyI18nMessagesPlugin } from './config/i18n-empty-placeholders.js';
import { defaultLocale, i18nLocales, localeCookieName } from './config/i18n.js';

// Resolved once at config evaluation so the dashboard's login page publishes the same sign-in
// policy `server/auth.config.ts` enforces at runtime (AUTH_ENABLE_SIGNUP, GitHub OAuth
// credentials). Build-time capture is deliberate: the deployment contract (documented in README
// and .env.example) is that the app is rebuilt whenever those policy variables change. The server
// config enforces its own policy regardless, so a stale build can only mislabel the login page,
// never open a sign-in method the server rejects.
const authPolicy = authConfigFromEnvironment();

export default defineNuxtConfig({
  compatibilityDate: '2026-08-09',
  devtools: { enabled: false },
  // Better Auth is mounted in-process (`server/auth.config.ts`), so the session cookie belongs to
  // this app's own origin and a server render can observe it directly: SSR resolves the session
  // from the request cookie before the first paint, instead of flashing a signed-out page that the
  // client then corrects.
  ssr: true,
  future: {
    compatibilityVersion: 5,
  },
  modules: [
    '@unocss/nuxt',
    '@nuxt/icon',
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
  icon: {
    // Icons stay fully client-bundled rather than served or fetched at runtime, regardless of the
    // app's own server routes. Every icon is scanned from the templates at build time and compiled
    // into the client bundle from the locally installed lucide collection.
    provider: 'none',
    serverBundle: false,
    fallbackToApi: false,
    clientBundle: { scan: true },
  },
  vite: {
    // Untranslated keys are stored as empty strings; drop them from the bundle so vue-i18n falls
    // back to the default locale instead of rendering "".
    plugins: [stripEmptyI18nMessagesPlugin()],
  },
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
    // Full mode: the module reads `server/auth.config.ts`, mounts Better Auth at `/api/auth/**`
    // itself, and resolves sessions server-side from the request cookie for SSR.
    redirects: {
      login: loginPath,
      guest: '/',
      authenticated: '/',
      logout: loginPath,
    },
  },
  runtimeConfig: {
    public: {
      // The module auto-detects the base URL from the incoming request in most deployments.
      // Declared here (empty by default) so NUXT_PUBLIC_SITE_URL can still override it for a
      // custom domain or deterministic OAuth callbacks.
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? '',
    },
  },
  // Published through appConfig rather than runtimeConfig.public: Nuxt maps NUXT_PUBLIC_* env vars
  // onto public runtime keys, which would let a deployment advertise a sign-in capability that
  // diverges from the policy `server/auth.config.ts` enforces from the same environment. appConfig
  // has no env override channel, so AUTH_ENABLE_SIGNUP and the GitHub OAuth credentials stay the
  // single authoritative source for both the build-time label and the runtime enforcement.
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
