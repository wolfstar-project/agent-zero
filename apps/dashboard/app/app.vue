<template>
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator color="var(--az-accent)" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { app } from '~~/config/app.js';
import { locales } from '~~/config/i18n.js';
import type { LocaleCode } from '~~/config/i18n.js';

const { locale } = useI18n();

// `nuxt.config.ts` cannot know the active locale, so the document language is bound here instead.
useHead(() => ({
  htmlAttrs: { lang: locales[locale.value as LocaleCode]?.language ?? locale.value },
}));

useSeoMeta({
  title: app.title,
  description: app.description,
  ogTitle: app.title,
  ogDescription: app.description,
  ogType: 'website',
  // An internal operations console has nothing to gain from being indexed.
  robots: 'noindex, nofollow',
});
</script>
