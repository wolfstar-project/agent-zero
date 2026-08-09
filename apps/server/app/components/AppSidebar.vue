<script setup lang="ts">
const navItems = [
  { label: 'Control', active: true },
  { label: 'Tasks', active: false },
  { label: 'Runners', active: false },
  { label: 'Policies', active: false },
];
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-20 hidden w-48 flex-col border-r border-line bg-panel md:flex"
  >
    <div class="h-16 flex items-center border-b border-line px-4">
      <div class="h-7 w-7 grid place-items-center border border-accent/45 bg-accent/8">
        <span class="h-2 w-2 bg-accent shadow-[0_0_14px_#82e849]" />
      </div>
      <div class="ml-3">
        <p class="m-0 text-sm font-750 tracking-tight">AGENT ZERO</p>
        <p class="m-0 text-[9px] text-muted font-650 tracking-[0.18em] uppercase">Control plane</p>
      </div>
    </div>

    <nav aria-label="Primary" class="flex-1 px-3 py-5">
      <p class="mb-2 px-2 text-[9px] text-muted font-700 tracking-[0.2em] uppercase">Operations</p>
      <button
        v-for="item in navItems"
        :key="item.label"
        class="az-focus mb-1 h-9 w-full flex items-center border-l-2 px-3 text-left text-xs font-600 transition"
        :class="
          item.active
            ? 'border-accent bg-accent/8 text-ink'
            : 'cursor-default border-transparent text-muted hover:bg-raised hover:text-ink'
        "
        :aria-current="item.active ? 'page' : undefined"
        type="button"
      >
        <span
          class="mr-2.5 h-1.5 w-1.5"
          :class="item.active ? 'bg-accent' : 'border border-muted'"
        />
        {{ item.label }}
      </button>
    </nav>

    <div class="border-t border-line p-4">
      <div class="flex items-center justify-between az-mono">
        <span class="text-muted">SYSTEM</span>
        <span class="flex items-center gap-1.5 text-accent">
          <span class="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_#82e849]" />
          ONLINE
        </span>
      </div>
      <p class="mb-0 mt-2 text-[10px] text-muted leading-relaxed">
        Durable queue · isolated runners
      </p>
    </div>
  </aside>
</template>
