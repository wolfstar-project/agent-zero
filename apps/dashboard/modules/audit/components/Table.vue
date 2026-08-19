<template>
  <section class="panel overflow-hidden">
    <div class="section-title">
      <div class="flex items-center gap-2">
        <h2 class="m-0 text-xs font-750 tracking-[0.12em] uppercase">
          {{ $t('dashboard.audit.table.title') }}
        </h2>
        <span class="border border-line bg-raised px-1.5 py-0.5 mono text-muted">
          {{ events.length }}
        </span>
      </div>
      <span class="mono text-muted">{{ $t('dashboard.audit.table.order') }}</span>
    </div>

    <div v-if="error" class="min-h-52 grid place-items-center px-5 py-10 text-center">
      <div>
        <div class="mx-auto h-9 w-9 grid place-items-center border border-danger/45 bg-danger/8">
          <Icon aria-hidden="true" class="h-4 w-4 text-danger" name="lucide:shield-alert" />
        </div>
        <h3 class="mb-0 mt-4 text-sm font-650">{{ $t('dashboard.audit.error.title') }}</h3>
        <p class="mx-auto mb-0 mt-2 max-w-80 text-xs text-muted leading-relaxed">
          {{ $t(errorMessageKey) }}
        </p>
        <button
          v-if="error !== 'forbidden'"
          class="btn-subtle mt-4 gap-2 px-3"
          type="button"
          @click="$emit('retry')"
        >
          <Icon aria-hidden="true" class="h-3.5 w-3.5" name="lucide:refresh-cw" />
          {{ $t('dashboard.audit.error.retry') }}
        </button>
      </div>
    </div>

    <div v-else-if="events.length > 0" class="overflow-x-auto">
      <table class="w-full min-w-160 border-collapse text-start">
        <caption class="sr-only">
          {{
            $t('dashboard.audit.table.caption')
          }}
        </caption>
        <thead>
          <tr class="border-b border-line bg-raised/55">
            <th scope="col" class="px-3.5 py-2.5 label-upper">
              {{ $t('dashboard.audit.table.columns.time') }}
            </th>
            <th scope="col" class="px-3.5 py-2.5 label-upper">
              {{ $t('dashboard.audit.table.columns.actor') }}
            </th>
            <th scope="col" class="px-3.5 py-2.5 label-upper">
              {{ $t('dashboard.audit.table.columns.action') }}
            </th>
            <th scope="col" class="px-3.5 py-2.5 label-upper">
              {{ $t('dashboard.audit.table.columns.subject') }}
            </th>
            <th scope="col" class="px-3.5 py-2.5 label-upper">
              {{ $t('dashboard.audit.table.columns.outcome') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in events"
            :key="entry.id"
            class="border-b border-line/70 last:border-b-0"
          >
            <td class="px-3.5 py-3 font-mono text-3xs text-muted">
              {{ new Date(entry.occurredAt).toLocaleString(locale) }}
            </td>
            <td class="px-3.5 py-3">
              <p class="m-0 text-xs font-650">{{ entry.actor.name }}</p>
              <p class="m-0 mt-1 font-mono text-3xs text-muted">{{ entry.actor.kind }}</p>
            </td>
            <td class="px-3.5 py-3">
              <p class="m-0 font-mono text-xs text-link">{{ entry.action }}</p>
              <p v-if="details(entry)" class="m-0 mt-1 max-w-72 truncate text-3xs text-muted">
                {{ details(entry) }}
              </p>
            </td>
            <td class="px-3.5 py-3 font-mono text-3xs text-muted">
              {{ entry.subject ? `${entry.subject.type}:${entry.subject.id}` : '—' }}
            </td>
            <td class="px-3.5 py-3"><AuditOutcomeBadge :outcome="entry.outcome" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="pending" class="min-h-52 grid place-items-center px-5 py-10">
      <p class="m-0 mono text-muted">{{ $t('dashboard.audit.table.loading') }}</p>
    </div>

    <div v-else class="min-h-52 grid place-items-center px-5 py-10 text-center">
      <div>
        <div class="mx-auto h-9 w-9 grid place-items-center border border-line bg-raised">
          <Icon aria-hidden="true" class="h-4 w-4 text-muted" name="lucide:scroll-text" />
        </div>
        <h3 class="mb-0 mt-4 text-sm font-650">{{ $t('dashboard.audit.table.emptyTitle') }}</h3>
        <p class="mx-auto mb-0 mt-2 max-w-80 text-xs text-muted leading-relaxed">
          {{ $t('dashboard.audit.table.emptyBody') }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AuditEvent } from '@agent-zero/api';

import type { AuditLogError } from '../composables/useAuditLogs';

const props = defineProps<{
  events: AuditEvent[];
  pending?: boolean;
  error?: AuditLogError | null;
}>();
defineEmits<{ retry: [] }>();

const { locale } = useI18n();

// Spelled out rather than interpolated, so `i18n:report` can verify all three keys exist.
const ERROR_MESSAGE_KEYS: Readonly<Record<AuditLogError, string>> = {
  forbidden: 'dashboard.audit.error.forbidden',
  unauthorized: 'dashboard.audit.error.unauthorized',
  generic: 'dashboard.audit.error.generic',
};

const errorMessageKey = computed(() =>
  props.error ? ERROR_MESSAGE_KEYS[props.error] : ERROR_MESSAGE_KEYS.generic,
);

/** Metadata rendered as one line; the durable record keeps the structure. */
function details(entry: AuditEvent): string {
  return Object.entries(entry.metadata ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(' · ');
}
</script>
