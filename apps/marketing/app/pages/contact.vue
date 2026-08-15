<template>
  <div class="section-y">
    <div class="shell max-w-3xl">
      <h1 class="m-0 text-headline font-750 tracking-tight">
        {{ $t('marketing.pages.contact.heading') }}
      </h1>
      <p class="m-0 mt-4 lede">{{ $t('marketing.pages.contact.body') }}</p>

      <ContactChannels />
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

useSeoMeta({
  title: () => t('marketing.pages.contact.title'),
  description: () => t('marketing.pages.contact.description'),
  ogTitle: () => t('marketing.pages.contact.title'),
  ogDescription: () => t('marketing.pages.contact.description'),
});
</script>
