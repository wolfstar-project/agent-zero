<template>
  <div>
    <MarketingPricingTable />
    <MarketingFaq />
    <MarketingCallToAction />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

useSeoMeta({
  title: () => t('marketing.pages.pricing.title'),
  description: () => t('marketing.pages.pricing.description'),
  ogTitle: () => t('marketing.pages.pricing.title'),
  ogDescription: () => t('marketing.pages.pricing.description'),
});
</script>
