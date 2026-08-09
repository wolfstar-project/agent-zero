import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2026-08-09',
  devtools: { enabled: false },
  future: {
    compatibilityVersion: 5,
  },
  modules: ['@unocss/nuxt'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'color-scheme', content: 'dark' }],
      title: 'Agent Zero · Control Plane',
    },
  },
  nitro: {
    storage: {
      'agent-zero': {
        driver: 'fs',
        base: './.data/agent-zero',
      },
    },
  },
  routeRules: {
    '/': { appLayout: 'default' },
    '/api/**': { cache: false },
    '/rpc/**': { cache: false },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
});
