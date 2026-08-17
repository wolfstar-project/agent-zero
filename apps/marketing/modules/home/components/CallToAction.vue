<template>
  <section class="section-y">
    <div class="shell">
      <div class="panel border-accent/35 bg-accent/4 px-6 py-12 text-center sm:px-12">
        <h2 class="m-0 text-headline font-750 tracking-tight">{{ $t('marketing.cta.title') }}</h2>
        <p class="mx-auto m-0 mt-4 max-w-2xl lede">{{ $t('marketing.cta.subtitle') }}</p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a class="btn btn-accent" :href="dashboardUrl">
            {{ $t('marketing.cta.primary') }}
            <Icon aria-hidden="true" class="h-4 w-4 rtl:scale-x-[-1]" name="lucide:arrow-right" />
          </a>
          <NuxtLink class="btn btn-subtle" :to="localePath({ path: '/contact' })">
            {{ $t('marketing.cta.secondary') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const localePath = useLocalePath();
const dashboardUrl = useRuntimeConfig().public.dashboardUrl;
</script>
