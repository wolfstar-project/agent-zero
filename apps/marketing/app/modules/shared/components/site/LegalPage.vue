<template>
  <div class="section-y">
    <div class="shell max-w-3xl">
      <h1 class="m-0 text-headline font-750 tracking-tight">{{ title }}</h1>
      <p class="m-0 mt-3 text-xs text-muted">
        {{ $t('marketing.legal.lastUpdated') }}:
        <time :datetime="lastUpdated">{{ lastUpdated }}</time>
      </p>

      <p
        class="m-0 mt-8 border border-warning/45 bg-warning/8 p-4 text-sm text-ink leading-relaxed"
        role="note"
      >
        {{ $t('marketing.legal.placeholder') }}
      </p>

      <div class="mt-8 flex flex-col gap-6 text-sm text-muted leading-relaxed">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  /** ISO 8601 date; rendered verbatim so the document never claims a freshness it lacks. */
  lastUpdated: string;
}>();
</script>
