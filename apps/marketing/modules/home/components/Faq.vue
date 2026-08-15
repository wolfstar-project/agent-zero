<template>
  <section id="faq" class="section-y scroll-mt-20">
    <div class="shell">
      <div class="max-w-2xl">
        <h2 class="m-0 text-headline font-750 tracking-tight">{{ $t('marketing.faq.title') }}</h2>
        <p class="m-0 mt-4 lede">{{ $t('marketing.faq.subtitle') }}</p>
      </div>

      <!-- Native <details>: keyboard operable, findable by in-page search, and expanded correctly
           when printed, none of which a hand-rolled accordion gets for free. -->
      <div class="mt-10 max-w-3xl border-t border-line">
        <details v-for="entry in faqEntries" :key="entry.id" class="faq-item border-b border-line">
          <summary
            class="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-start text-sm font-650"
          >
            {{ $t(`marketing.faq.items.${entry.id}.question`) }}
            <Icon
              aria-hidden="true"
              class="faq-marker h-4 w-4 shrink-0 text-muted transition-transform"
              name="lucide:chevron-down"
            />
          </summary>
          <p class="m-0 max-w-2xl pb-5 text-sm text-muted leading-relaxed">
            {{ $t(`marketing.faq.items.${entry.id}.answer`) }}
          </p>
        </details>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { faqEntries } from '~~/config/content.js';
</script>

<style scoped>
/* Safari still paints its own disclosure triangle unless both are cleared. */
.faq-item summary::-webkit-details-marker {
  display: none;
}

.faq-item[open] .faq-marker {
  transform: rotate(180deg);
}
</style>
