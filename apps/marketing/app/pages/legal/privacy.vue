<template>
  <SiteLegalPage v-if="page" :title="page.title" :last-updated="page.lastUpdated">
    <ContentRenderer :value="page" />
  </SiteLegalPage>
</template>

<script setup lang="ts">
// This document ships in English only (see content.config.ts); the surrounding page chrome
// (nav, footer) stays fully translated through packages/i18n regardless of the visitor's locale.
const { data: page } = await useAsyncData('legal-privacy', () =>
  queryCollection('legal').path('/legal/privacy').first(),
);

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' });
}

useSeoMeta({
  title: () => page.value?.title,
  description: () => page.value?.description,
  ogTitle: () => page.value?.title,
  ogDescription: () => page.value?.description,
  // Placeholder copy the project ships as a starting point. Indexing it would put text that is
  // explicitly not legal advice into search results; a deployment that replaces the body should
  // drop this line at the same time.
  robots: 'noindex, follow',
});
</script>
