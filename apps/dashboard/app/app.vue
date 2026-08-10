<script setup lang="ts">
import { config, locales } from '~~/config/index.js';
import type { LocaleCode } from '~~/config/index.js';

const { locale } = useI18n();

// `nuxt.config.ts` cannot know the active locale, so the document language is bound here instead.
useHead(() => ({
  htmlAttrs: { lang: locales[locale.value as LocaleCode]?.language ?? locale.value },
}));

useSeoMeta({
  title: config.app.title,
  description: config.app.description,
  ogTitle: config.app.title,
  ogDescription: config.app.description,
  ogType: 'website',
  // An internal operations console has nothing to gain from being indexed.
  robots: 'noindex, nofollow',
});
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator color="var(--az-accent)" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
