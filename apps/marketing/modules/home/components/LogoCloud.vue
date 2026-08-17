<template>
  <section class="border-y border-line bg-panel/50 py-10">
    <div class="shell">
      <h2 class="m-0 text-center eyebrow">{{ $t('marketing.logos.title') }}</h2>
      <ul
        class="m-0 mt-6 list-none flex flex-wrap items-center justify-center gap-x-10 gap-y-5 ps-0"
      >
        <li
          v-for="entry in logoCloud"
          :key="entry.id"
          class="flex items-center gap-2 text-sm text-muted font-650"
        >
          <Icon aria-hidden="true" class="h-4.5 w-4.5" :name="entry.icon" />
          {{ entry.label }}
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { logoCloud } from '~~/config/content.js';
</script>
