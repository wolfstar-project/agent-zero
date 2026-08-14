<template>
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator color="var(--az-accent)" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { locales } from '@agent-zero/i18n';
import type { LocaleCode } from '@agent-zero/i18n';
import { app } from '~~/config/app.js';

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
