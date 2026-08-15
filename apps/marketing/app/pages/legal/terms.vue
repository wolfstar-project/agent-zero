<template>
  <SiteLegalPage v-if="page" :title="page.title" :last-updated="page.lastUpdated">
    <ContentRenderer :value="page" />
  </SiteLegalPage>
</template>

<script setup lang="ts">
import type { Collections } from '@nuxt/content';

const { locale } = useI18n();

// The key carries the locale so prerendering — which runs every route through the same server
// process — can't let the English and Italian builds share one cached result.
const { data: page } = await useAsyncData(
  `legal-terms-${locale.value}`,
  () => {
    const collection = `legal_${locale.value}` as keyof Collections;
    return queryCollection(collection).path('/legal/terms').first();
  },
  { watch: [locale] },
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
