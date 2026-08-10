<template>
  <aside
    class="fixed inset-y-0 inset-is-0 z-20 hidden w-48 flex-col border-ie border-line bg-panel md:flex"
  >
    <div class="h-16 flex items-center border-b border-line px-4">
      <div class="h-7 w-7 grid place-items-center border border-accent/45 bg-accent/8">
        <span class="h-2 w-2 bg-accent shadow-[0_0_14px_var(--az-accent-glow)]" />
      </div>
      <div class="ms-3">
        <p class="m-0 text-sm font-750 tracking-tight">AGENT ZERO</p>
        <p class="m-0 text-4xs text-muted font-650 tracking-[0.18em] uppercase">
          {{ $t('common.brand.subtitle') }}
        </p>
      </div>
    </div>

    <nav :aria-label="$t('dashboard.nav.aria')" class="flex-1 px-3 py-5">
      <p class="mb-2 px-2 text-4xs text-muted font-700 tracking-[0.2em] uppercase">
        {{ $t('dashboard.nav.group') }}
      </p>
      <button
        v-for="item in navItems"
        :key="item.key"
        class="focus-ring mb-1 h-9 w-full flex items-center border-is-2 px-3 text-start text-xs font-600 transition"
        :class="
          item.active
            ? 'border-accent bg-accent/8 text-ink'
            : 'cursor-default border-transparent text-muted hover:bg-raised hover:text-ink'
        "
        :aria-current="item.active ? 'page' : undefined"
        type="button"
      >
        <span
          class="me-2.5 h-1.5 w-1.5"
          :class="item.active ? 'bg-accent' : 'border border-muted'"
        />
        {{ $t(`dashboard.nav.${item.key}`) }}
      </button>
    </nav>

    <ClientOnly>
      <UserMenu />
    </ClientOnly>

    <div class="border-t border-line p-4">
      <div class="flex items-center justify-between mono">
        <span class="text-muted">{{ $t('common.system.label') }}</span>
        <span class="flex items-center gap-1.5 text-accent">
          <span class="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--az-accent-glow)]" />
          {{ $t('common.system.ready') }}
        </span>
      </div>
      <p class="mb-0 mt-2 text-3xs text-muted leading-relaxed">
        {{ $t('dashboard.nav.footnote') }}
      </p>
    </div>
  </aside>
</template>

<script setup lang="ts">
const navItems = [
  { key: 'control', active: true },
  { key: 'tasks', active: false },
  { key: 'runners', active: false },
  { key: 'policies', active: false },
] as const;
</script>
