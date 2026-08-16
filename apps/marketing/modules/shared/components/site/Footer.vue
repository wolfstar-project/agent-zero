<template>
  <footer :aria-label="$t('marketing.footer.aria')" class="border-t border-line bg-panel">
    <div class="shell grid gap-10 py-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
      <div class="max-w-sm">
        <div class="flex items-center gap-2.5">
          <span
            class="h-8 w-8 grid shrink-0 place-items-center border border-accent/45 bg-accent/8"
            aria-hidden="true"
          >
            <span class="font-mono text-xs text-accent font-750">AZ</span>
          </span>
          <span class="text-sm font-750 tracking-tight">{{ site.name }}</span>
        </div>
        <p class="m-0 mt-4 text-sm text-muted leading-relaxed">
          {{ $t('marketing.footer.tagline') }}
        </p>
      </div>

      <nav v-for="column in columns" :key="column.id" :aria-label="$t(column.labelKey)">
        <p class="m-0 eyebrow">{{ $t(column.labelKey) }}</p>
        <ul class="m-0 mt-4 list-none flex flex-col gap-2.5 ps-0">
          <li v-for="link in column.links" :key="link.id">
            <NuxtLink
              class="focus-ring text-sm text-muted transition hover:text-ink"
              :to="link.to"
              :external="link.external"
              :target="link.external ? '_blank' : undefined"
              :rel="link.external ? 'noreferrer' : undefined"
            >
              {{ $t(link.labelKey) }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>

    <div class="border-t border-line">
      <div class="shell flex flex-wrap items-center justify-between gap-3 py-5">
        <p class="m-0 text-xs text-muted">© {{ year }} {{ $t('marketing.footer.copyright') }}</p>
        <ClientOnly>
          <ColorModeToggle />
        </ClientOnly>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const localePath = useLocalePath();

// Rendered on the server and hydrated on the client, so it has to be stable across both. The
// prerender happens at build time, which means a site left un-rebuilt across New Year shows the
// build's year — the honest reading of a static page, and better than a hydration mismatch.
const year = new Date().getFullYear();

const columns = computed(() => [
  {
    id: 'product',
    labelKey: 'marketing.footer.product',
    links: [
      {
        id: 'pricing',
        labelKey: 'marketing.nav.pricing',
        to: localePath('/pricing'),
        external: false,
      },
      {
        id: 'contact',
        labelKey: 'marketing.nav.contact',
        to: localePath('/contact'),
        external: false,
      },
      {
        id: 'changelog',
        labelKey: 'marketing.footer.changelog',
        to: links.changelog,
        external: true,
      },
    ],
  },
  {
    id: 'resources',
    labelKey: 'marketing.footer.resources',
    links: [
      { id: 'blog', labelKey: 'marketing.nav.blog', to: localePath('/blog'), external: false },
      { id: 'docs', labelKey: 'marketing.nav.docs', to: links.docs, external: true },
      {
        id: 'architecture',
        labelKey: 'marketing.footer.architecture',
        to: links.architecture,
        external: true,
      },
      { id: 'github', labelKey: 'marketing.footer.github', to: links.repository, external: true },
    ],
  },
  {
    id: 'legal',
    labelKey: 'marketing.footer.legal',
    links: [
      {
        id: 'privacy',
        labelKey: 'marketing.footer.privacy',
        to: localePath('/legal/privacy'),
        external: false,
      },
      {
        id: 'terms',
        labelKey: 'marketing.footer.terms',
        to: localePath('/legal/terms'),
        external: false,
      },
    ],
  },
]);
</script>
