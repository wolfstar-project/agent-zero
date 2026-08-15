<template>
  <section id="features" class="section-y scroll-mt-20">
    <div class="shell">
      <div class="max-w-2xl">
        <h2 class="m-0 text-headline font-750 tracking-tight">
          {{ $t('marketing.features.title') }}
        </h2>
        <p class="m-0 mt-4 lede">{{ $t('marketing.features.subtitle') }}</p>
      </div>

      <ul class="m-0 mt-12 grid list-none gap-4 ps-0 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="feature in featureCards" :key="feature.id" class="card">
          <span
            class="h-9 w-9 grid place-items-center border border-accent/45 bg-accent/8 text-accent"
            aria-hidden="true"
          >
            <Icon class="h-4.5 w-4.5" :name="feature.icon" />
          </span>
          <h3 class="m-0 mt-4 text-base font-700">
            {{ $t(`marketing.features.items.${feature.id}.title`) }}
          </h3>
          <p class="m-0 mt-2 text-sm text-muted leading-relaxed">
            {{ $t(`marketing.features.items.${feature.id}.description`) }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { featureCards } from '~~/config/content.js';
</script>
