import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultLocale, i18nLocalesFor, localeCookieName } from '@agent-zero/i18n';
import { defineNuxtConfig } from 'nuxt/config';

import { app, ui } from './config/app.js';
import { authConfigFromEnvironment, loginPath } from './config/auth.js';

// Resolved once at config evaluation so the dashboard's login page publishes the same sign-in
// policy `server/auth.config.ts` enforces at runtime (AUTH_ENABLE_SIGNUP, GitHub OAuth
// credentials). Build-time capture is deliberate: the deployment contract (documented in README
// and .env.example) is that the app is rebuilt whenever those policy variables change. The server
// config enforces its own policy regardless, so a stale build can only mislabel the login page,
// never open a sign-in method the server rejects.
const authPolicy = authConfigFromEnvironment();

// `@nuxtjs/i18n`'s `langDir` does not support absolute paths in production, so a module-provided
// locale directory has to be wired through each locale's `files` entries instead (the module's own
// documented pattern for this). `i18nLocalesFor` keeps its `files` entries package-relative
// (`en/common.json`) so they stay portable; this is the one place that resolves them against the
// installed package's real `locales/` directory.
const i18nPackageDirectory = dirname(
  fileURLToPath(import.meta.resolve('@agent-zero/i18n/package.json')),
);
const i18nLocalesDirectory = join(i18nPackageDirectory, 'locales');
// Only the scopes this app renders: every listed file is deep-merged into the bundle whether or
// not a key from it is read, so the marketing site's copy has no business being here.
const dashboardLocales = i18nLocalesFor([
  'common.json',
  'errors.json',
  'auth.json',
  'dashboard.json',
  'organizations.json',
]);
const resolvedI18nLocales = dashboardLocales.map((locale) => ({
  ...locale,
  files: locale.files.map((file) => join(i18nLocalesDirectory, file)),
}));

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
  // `modules/` is scanned by Nuxt itself, so the local modules (shared, auth, dashboard,
  // organizations, i18n-strip-empty, vitehub) register themselves — and register their own
  // component and composable directories — without being listed here.
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

  i18n: {
    locales: resolvedI18nLocales,
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
      enableOrganizations: authPolicy.enableOrganizations,
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
    '/organizations': { appLayout: 'default', auth: { only: 'user' } },
    // Reached from an invitation email, so the visitor is frequently signed out at that moment:
    // requiring a session sends them through /login and back, rather than rejecting the link.
    '/organizations/accept-invitation/**': { appLayout: 'default', auth: { only: 'user' } },
  },

  typescript: {
    strict: true,
    typeCheck: false,
    // Extends the generated `.nuxt/tsconfig.*.json` projects rather than a hand-maintained
    // `tsconfig.e2e.json` + `.vue` shim: `nuxt typecheck` (Golar, see golar.config.ts) already
    // resolves `.vue` imports, so specs that import components only need to be in its scope.
    tsConfig: {
      compilerOptions: {
        noUnusedLocals: true,
        allowImportingTsExtensions: true,
      },
      // `test/nuxt/**` runs in a Nuxt/DOM context and imports `.vue` components directly.
      include: ['../test/nuxt/**/*.ts'],
    },
    nodeTsConfig: {
      compilerOptions: {
        allowImportingTsExtensions: true,
      },
      // `test/unit/**` is plain Node: no DOM, no `.vue` imports, explicit imports only.
      // `test/e2e/**` and `playwright.config.ts` run in Playwright's own Node process.
      include: ['../test/unit/**/*.ts', '../test/e2e/**/*.ts', '../playwright.config.ts'],
    },
  },
});
