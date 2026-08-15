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

<style scoped>
/* Minimal Prose styling for the rendered Markdown body: UnoCSS has no typography preset in this
   project, and pulling one in for two documents would be a heavier dependency than a few rules. */
.prose :deep(h2) {
  margin-block: 1.5em 0.5em;
  font-size: 1rem;
  font-weight: 700;
  color: var(--az-ink);
}

.prose :deep(p) {
  margin-block: 0.75em;
}

.prose :deep(blockquote) {
  margin-block: 1em;
  border-inline-start: 2px solid var(--az-warning);
  background: color-mix(in oklch, var(--az-warning) 8%, transparent);
  padding: 0.75rem 1rem;
  color: var(--az-ink);
}

.prose :deep(a) {
  color: var(--az-link);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.prose :deep(ul) {
  margin-block: 0.75em;
  padding-inline-start: 1.25em;
}
</style>
