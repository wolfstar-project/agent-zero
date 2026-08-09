import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2026-08-09',
  devtools: { enabled: false },
  future: {
    compatibilityVersion: 5,
  },
  modules: [
    '@unocss/nuxt',
    [
      '@nuxtjs/color-mode',
      {
        preference: 'system',
        fallback: 'dark',
        dataValue: 'theme',
        storageKey: 'agent-zero-color-mode',
      },
    ],
  ],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'color-scheme', content: 'dark light' }],
      title: 'Agent Zero · Dashboard',
    },
  },
  routeRules: {
    '/': { appLayout: 'default' },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
});
