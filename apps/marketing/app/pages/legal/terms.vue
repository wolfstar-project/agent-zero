<template>
  <SiteLegalPage v-if="page" :title="page.title" :last-updated="page.lastUpdated">
    <ContentRenderer :value="page" />
  </SiteLegalPage>
</template>

<script setup lang="ts">
// This document ships in English only; see the note in legal/privacy.vue.
const { data: page } = await useAsyncData('legal-terms', () =>
  queryCollection('legal').path('/legal/terms').first(),
);

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' });
}

useSeoMeta({
  title: () => page.value?.title,
  description: () => page.value?.description,
  ogTitle: () => page.value?.title,
  ogDescription: () => page.value?.description,
  // See the note in `legal/privacy.vue`: placeholder copy stays out of the index.
  robots: 'noindex, follow',
});
</script>
