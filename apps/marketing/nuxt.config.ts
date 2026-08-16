import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { defaultLocale, i18nLocalesFor, localeCookieName } from '@agent-zero/i18n';
import { defineNuxtConfig } from 'nuxt/config';

import { featureCards, logoCloud } from './config/content.js';
import { stripEmptyI18nMessagesPlugin } from './config/i18n-empty-placeholders.js';

// `@nuxtjs/i18n`'s `langDir` does not support absolute paths in production, so a module-provided
// locale directory has to be wired through each locale's `files` entries instead (the module's own
// documented pattern for this). `@agent-zero/i18n` keeps the entries package-relative
// (`en/common.json`) so they stay portable; this is the one place that resolves them against the
// installed package's real `locales/` directory.
const i18nPackageDirectory = dirname(
  fileURLToPath(import.meta.resolve('@agent-zero/i18n/package.json')),
);
const i18nLocalesDirectory = join(i18nPackageDirectory, 'locales');
const resolvedI18nLocales = i18nLocalesFor(['common.json', 'errors.json', 'marketing.json']).map(
  (locale) => ({
    ...locale,
    files: locale.files.map((file) => join(i18nLocalesDirectory, file)),
  }),
);

// Read directly here rather than through a `config/app.ts` wrapper: each is used exactly once, to
// populate the two Nuxt config fields below, and neither is needed anywhere else in the app —
// components that need the dashboard's origin read it back from `runtimeConfig.public`.
const siteUrl = process.env.MARKETING_SITE_URL?.trim() || 'http://localhost:3001';
const dashboardUrl = process.env.MARKETING_DASHBOARD_URL?.trim() || 'http://localhost:3000';

export default defineNuxtConfig({
  compatibilityDate: '2026-08-09',
  devtools: { enabled: false },
  // The opposite trade-off from the dashboard: this site exists to be crawled, quoted, and read
  // over a cold connection, so every route is rendered ahead of time and shipped as HTML.
  ssr: true,
  future: {
    compatibilityVersion: 5,
  },
  devServer: {
    // 3000 is the dashboard (the single deployable app, UI + API + auth).
    port: 3001,
  },
  modules: [
    '@unocss/nuxt',
    '@nuxt/icon',
    '@nuxt/content',
    '@nuxtjs/i18n',
    '@nuxtjs/seo',
    [
      '@nuxtjs/color-mode',
      {
        preference: 'system',
        fallback: 'dark',
        dataValue: 'theme',
        // Deliberately distinct from the dashboard's key: the two apps are separate origins in
        // production, and sharing a key would only couple them if they were ever proxied under one.
        storageKey: 'agent-zero-marketing-color-mode',
      },
    ],
    // One local module per feature directory (each its own `defineNuxtModule`, following the
    // nuxt-modules skill's local-module convention: `modules/<name>/index.ts` registered as
    // `./modules/<name>`) rather than inline `components`/`imports` config here or one module
    // covering all three — matching `apps/dashboard/modules/vitehub.ts` and wolfstar.rocks' own
    // top-level `modules/` convention.
    './modules/shared',
    './modules/home',
    './modules/contact',
    './modules/blog',
  ],
  css: ['~/assets/css/main.css'],
  icon: {
    // The site must render identically without reaching the Iconify API at request time, so every
    // icon is compiled into the client bundle at build time from the locally installed lucide
    // collection.
    provider: 'none',
    serverBundle: false,
    fallbackToApi: false,
    clientBundle: {
      // Catches every icon named as a literal in a template or SFC script block.
      scan: true,
      // The scanner cannot see icons that reach `<Icon>` through a `:name` binding, so the ones
      // that live in `config/content.ts` are listed from that same source. Deriving the list
      // instead of retyping it means adding a card cannot silently ship a missing icon.
      icons: [...featureCards.map((card) => card.icon), ...logoCloud.map((entry) => entry.icon)],
    },
  },
  vite: {
    // Untranslated keys are stored as empty strings; drop them from the bundle so vue-i18n falls
    // back to the default locale instead of rendering "".
    plugins: [stripEmptyI18nMessagesPlugin()],
  },
  content: {
    experimental: {
      // Node's built-in `node:sqlite` (Node 22.5+; this repo requires 24.2+) rather than the
      // `better-sqlite3` connector, which needs a native build step this repo's dependency
      // policy does not allow-list and CI does not run interactively to approve.
      nativeSqlite: true,
      sqliteConnector: 'native',
    },
  },
  i18n: {
    locales: resolvedI18nLocales,
    defaultLocale,
    // Locale-prefixed URLs are the point on a public site: they give each translation its own
    // indexable URL, which is also what lets the sitemap and hreflang tags describe them.
    strategy: 'prefix_except_default',
    // `baseUrl` is deliberately not set here: `site.url` below is the single origin, and
    // `@nuxtjs/seo` feeds it to the i18n module, the sitemap, and the canonical tags alike.
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: localeCookieName,
      // Redirecting a crawler off the URL it requested is the fastest way to lose the canonical.
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: defaultLocale,
    },
  },
  site: {
    url: siteUrl,
    // Mirrors `app.config.ts`'s `site.name`: that file is runtime-only (`useAppConfig()`), while
    // `@nuxtjs/seo` needs a literal value here at build time, so the two cannot share one source.
    name: 'Agent Zero',
  },
  robots: {
    allow: '*',
  },
  sitemap: {
    // Every route — including blog posts — is prerendered ahead of time (`nitro.prerender.crawlLinks`
    // below follows every link it finds, starting from `/`), so the sitemap needs no dynamic source:
    // it is built from the same static file list the build already produced.
    sources: [],
  },
  // `nuxt-og-image` renders per-page social cards, but it resolves its fonts over the network at
  // build time, which a build that must succeed offline and byte-for-byte cannot depend on. The
  // site ships one static card instead (`public/og-image.svg`, referenced from `app/app.vue`);
  // see this app's README for swapping in a rasterised PNG or turning generation back on.
  ogImage: { enabled: false },
  runtimeConfig: {
    public: {
      dashboardUrl,
    },
  },
  app: {
    head: {
      meta: [{ name: 'color-scheme', content: 'dark light' }],
      link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    },
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      // `/robots.txt` is a Nitro route rather than a page, so the crawler never reaches it; listing
      // it explicitly means a purely static deployment still serves one.
      routes: ['/', '/robots.txt'],
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
});
