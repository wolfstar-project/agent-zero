<template>
  <SiteLegalPage v-if="page" :title="page.title" :last-updated="page.lastUpdated">
    <ContentRenderer :value="page" />
  </SiteLegalPage>
</template>

<script setup lang="ts">
import type { Collections } from '@nuxt/content';

const { locale } = useI18n();

// The collection name encodes the locale (`legal_en`, `legal_it` — see `content.config.ts`), so a
// locale switch has to requery rather than filter client-side; `watch` keeps the two in sync. The
// key must carry the locale too: prerendering runs every route through the same server process,
// and a locale-less key would let the English and Italian builds share one cached result.
const { data: page } = await useAsyncData(
  `legal-privacy-${locale.value}`,
  () => {
    const collection = `legal_${locale.value}` as keyof Collections;
    return queryCollection(collection).path('/legal/privacy').first();
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
  // Placeholder copy the project ships as a starting point. Indexing it would put text that is
  // explicitly not legal advice into search results; a deployment that replaces the body should
  // drop this line at the same time.
  robots: 'noindex, follow',
});
</script>
