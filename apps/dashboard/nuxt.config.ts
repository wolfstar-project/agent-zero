import { defineNuxtConfig } from 'nuxt/config';

import { app, ui } from './config/app.js';
import { authConfigFromEnvironment, defaultAuthServerUrl, loginPath } from './config/auth.js';
import { stripEmptyI18nMessagesPlugin } from './config/i18n-empty-placeholders.js';
import { defaultLocale, i18nLocales, localeCookieName } from './config/i18n.js';

// Resolved once at config evaluation so the dashboard publishes the same sign-in policy the auth
// server derives from the shared environment (AUTH_ENABLE_SIGNUP, GitHub OAuth credentials).
// Build-time capture is deliberate: the deployment contract (documented in README and
// .env.example) is that the dashboard is rebuilt whenever those policy variables change. The
// auth server enforces its own policy regardless, so a stale build can only mislabel the login
// page, never open a sign-in method the server rejects.
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
  // Components live under per-module roots instead of the default `app/components`, matching
  // supastarter's modules/<feature> layout (with `shared` as its own module), so each root is
  // registered explicitly. Nesting under each root still derives the auto-import prefix from the
  // relative sub-path exactly like the default scanner did, so tag names (e.g. <TaskTable>,
  // <AppSidebar>) are unchanged.
  components: [
    { path: '~/modules/shared/components' },
    { path: '~/modules/auth/components' },
    { path: '~/modules/dashboard/components' },
    // Prefixed so the module's generic names (Switcher, MemberList, InviteForm) cannot collide
    // with another module's component of the same name.
    { path: '~/modules/organizations/components', prefix: 'Organizations' },
  ],
  imports: {
    // Composables also moved out of `app/composables`; Nuxt auto-imports by exported symbol name,
    // so call sites (useAuthErrorMessage(), useSidebarCollapsed()) are unaffected.
    dirs: [
      'modules/auth/composables',
      'modules/shared/composables',
      'modules/organizations/composables',
    ],
  },
  icon: {
    // The dashboard owns no Nitro routes and its e2e suite asserts that nothing hits a local
    // /api/** path, so the icon component may never fall back to a server endpoint or the
    // Iconify API. Every icon is scanned from the templates at build time and compiled into the
    // client bundle from the locally installed lucide collection.
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
  },
});
