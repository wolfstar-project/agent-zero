<template>
  <div class="section-y">
    <div class="shell max-w-3xl">
      <h1 class="m-0 text-headline font-750 tracking-tight">{{ title }}</h1>
      <p class="m-0 mt-3 text-xs text-muted">
        {{ $t('marketing.legal.lastUpdated') }}:
        <time :datetime="lastUpdated">{{ lastUpdated }}</time>
      </p>

      <div class="prose mt-8 max-w-none text-sm text-muted leading-relaxed">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  /** ISO 8601 date, from the document's own `lastUpdated` frontmatter. */
  lastUpdated: string;
}>();
</script>
