<template>
  <header
    class="h-16 flex items-center justify-between border-b border-line bg-canvas/92 px-4 backdrop-blur md:px-6"
  >
    <div>
      <p class="m-0 text-3xs text-muted font-700 tracking-[0.18em] uppercase">
        {{ $t('dashboard.audit.header.eyebrow') }}
      </p>
      <h1 class="m-0 mt-1 text-lg font-650 tracking-tight">
        {{ $t('dashboard.audit.header.title') }}
      </h1>
    </div>

    <div class="flex items-center gap-3">
      <LocaleSwitcher />
      <ClientOnly>
        <ColorModeToggle />
        <template #fallback>
          <span class="h-9 w-9 border border-line bg-raised" aria-hidden="true" />
        </template>
      </ClientOnly>
      <button class="btn-subtle gap-2 px-3" type="button" :disabled="pending" @click="refresh">
        <Icon aria-hidden="true" class="h-3.5 w-3.5" name="lucide:refresh-cw" />
        {{ $t('common.actions.refresh') }}
      </button>
    </div>
  </header>

  <div class="p-3 sm:p-4 md:p-5">
    <AuditTable
      ref="auditTable"
      :events="events"
      :pending="pending"
      :error="error"
      @retry="refresh"
    />

    <div v-if="nextCursor" class="mt-4 flex justify-center">
      <button class="btn-subtle gap-2 px-3" type="button" :disabled="pending" @click="loadMore">
        <Icon aria-hidden="true" class="h-3.5 w-3.5" name="lucide:chevron-down" />
        {{ $t('dashboard.audit.table.loadMore') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHotkeys } from '@tanstack/vue-hotkeys';

const { events, nextCursor, pending, error, loadMore, refresh } = useAuditLogs();

// Client-side only: the endpoint reads the session cookie, and this page is not first-paint
// content. See `useAuditLogs` for the full reasoning.
onMounted(refresh);

// Typed structurally rather than with `InstanceType`: the component is globally registered by the
// audit module, so there is no import here to take a type from.
const auditTable = useTemplateRef<{ focusFilter: () => void }>('auditTable');

// The sheet under `?` lists these; keep the two in step when either changes.
useHotkeys([
  { hotkey: 'R', callback: () => void refresh(), options: { enabled: () => !pending.value } },
  {
    hotkey: 'M',
    callback: () => void loadMore(),
    options: { enabled: () => Boolean(nextCursor.value) && !pending.value },
  },
  {
    hotkey: '/',
    callback: () => auditTable.value?.focusFilter(),
    // Otherwise the slash lands in the field it just focused.
    options: { preventDefault: true },
  },
]);
</script>
