<template>
  <SiteLegalPage :title="$t('marketing.pages.terms.title')" :last-updated="lastUpdated">
    <p class="m-0">{{ $t('marketing.pages.terms.description') }}</p>
  </SiteLegalPage>
</template>

<script setup lang="ts">
import { legalLastUpdated } from '~~/config/legal.js';

const { t } = useI18n();
const lastUpdated = legalLastUpdated;

useSeoMeta({
  title: () => t('marketing.pages.terms.title'),
  description: () => t('marketing.pages.terms.description'),
  // See the note in `legal/privacy.vue`: placeholder copy stays out of the index.
  robots: 'noindex, follow',
});
</script>
