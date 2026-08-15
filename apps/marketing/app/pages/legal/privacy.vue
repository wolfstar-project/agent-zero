<template>
  <SiteLegalPage :title="$t('marketing.pages.privacy.title')" :last-updated="lastUpdated">
    <p class="m-0">{{ $t('marketing.pages.privacy.description') }}</p>
  </SiteLegalPage>
</template>

<script setup lang="ts">
import { legalLastUpdated } from '~~/config/legal.js';

const { t } = useI18n();
const lastUpdated = legalLastUpdated;

useSeoMeta({
  title: () => t('marketing.pages.privacy.title'),
  description: () => t('marketing.pages.privacy.description'),
  // Placeholder copy the project ships as a starting point. Indexing it would put text that is
  // explicitly not legal advice into search results; a deployment that replaces the body should
  // drop this line at the same time.
  robots: 'noindex, follow',
});
</script>
