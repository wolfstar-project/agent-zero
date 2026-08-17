<template>
  <section class="section-y">
    <div class="shell">
      <div class="max-w-2xl">
        <h2 class="m-0 text-headline font-750 tracking-tight">
          {{ $t('marketing.testimonials.title') }}
        </h2>
        <p class="m-0 mt-4 lede">{{ $t('marketing.testimonials.subtitle') }}</p>
      </div>

      <ul class="m-0 mt-12 grid list-none gap-4 ps-0 lg:grid-cols-3">
        <li v-for="entry in testimonials" :key="entry.id" class="panel flex flex-col p-6">
          <blockquote class="m-0 flex-1 text-sm text-ink leading-relaxed">
            “{{ $t(`marketing.testimonials.items.${entry.id}.quote`) }}”
          </blockquote>
          <figcaption class="mt-6 flex items-center gap-3">
            <span
              class="h-9 w-9 grid shrink-0 place-items-center border border-line bg-raised mono text-muted"
              aria-hidden="true"
            >
              {{ entry.initials }}
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-650">
                {{ $t(`marketing.testimonials.items.${entry.id}.author`) }}
              </span>
              <span class="block truncate text-xs text-muted">
                {{ $t(`marketing.testimonials.items.${entry.id}.role`) }}
              </span>
            </span>
          </figcaption>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { testimonials } from '~~/config/content.js';
</script>
