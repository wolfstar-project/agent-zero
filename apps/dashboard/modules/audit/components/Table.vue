<template>
  <section class="panel overflow-hidden">
    <div class="section-title">
      <div class="flex items-center gap-2">
        <h2 class="m-0 text-xs font-750 tracking-[0.12em] uppercase">
          {{ $t('dashboard.audit.table.title') }}
        </h2>
        <span class="border border-line bg-raised px-1.5 py-0.5 mono text-muted">
          {{ visibleCount }}
        </span>
      </div>

      <label class="flex items-center gap-2">
        <span class="sr-only">{{ $t('common.table.filterLabel') }}</span>
        <Icon aria-hidden="true" class="h-3.5 w-3.5 text-muted" name="lucide:search" />
        <input
          ref="filterInput"
          v-model="query"
          class="input-field h-7 w-40 text-xs sm:w-56"
          type="search"
          :placeholder="$t('common.table.filterPlaceholder')"
        />
      </label>
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

    <div
      v-else-if="events.length === 0 && pending"
      class="min-h-52 grid place-items-center px-5 py-10"
    >
      <p class="m-0 mono text-muted">{{ $t('dashboard.audit.table.loading') }}</p>
    </div>

    <div
      v-else-if="events.length === 0"
      class="min-h-52 grid place-items-center px-5 py-10 text-center"
    >
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

    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-160 border-collapse text-start">
        <caption class="sr-only">
          {{
            $t('dashboard.audit.table.caption')
          }}
        </caption>
        <thead>
          <tr class="border-b border-line bg-raised/55">
            <th
              v-for="header in headers"
              :key="header.id"
              scope="col"
              class="px-3.5 py-2.5 label-upper"
              :aria-sort="ariaSort(header.column.getIsSorted())"
            >
              <button
                class="focus-ring flex items-center gap-1.5 text-inherit uppercase tracking-inherit"
                type="button"
                :aria-label="
                  $t('common.table.sortBy', { column: $t(columnLabelKey(header.column.id)) })
                "
                @click="header.column.getToggleSortingHandler()?.($event)"
              >
                {{ $t(columnLabelKey(header.column.id)) }}
                <Icon
                  aria-hidden="true"
                  class="h-3 w-3"
                  :class="header.column.getIsSorted() ? 'text-ink' : 'text-muted/60'"
                  :name="sortIcon(header.column.getIsSorted())"
                />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td class="px-3.5 py-10 text-center text-xs text-muted" :colspan="headers.length">
              {{ $t('common.table.noMatches') }}
            </td>
          </tr>
          <tr v-for="row in rows" :key="row.id" class="border-b border-line/70 last:border-b-0">
            <td class="px-3.5 py-3 font-mono text-3xs text-muted">
              {{ new Date(row.original.occurredAt).toLocaleString(locale) }}
            </td>
            <td class="px-3.5 py-3">
              <p class="m-0 text-xs font-650">{{ row.original.actor.name }}</p>
              <p class="m-0 mt-1 font-mono text-3xs text-muted">{{ row.original.actor.kind }}</p>
            </td>
            <td class="px-3.5 py-3">
              <p class="m-0 font-mono text-xs text-link">{{ row.original.action }}</p>
              <p
                v-if="details(row.original)"
                class="m-0 mt-1 max-w-72 truncate text-3xs text-muted"
              >
                {{ details(row.original) }}
              </p>
            </td>
            <td class="px-3.5 py-3 font-mono text-3xs text-muted">
              {{ subjectLabel(row.original) || '—' }}
            </td>
            <td class="px-3.5 py-3"><AuditOutcomeBadge :outcome="row.original.outcome" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AuditEvent } from '@agent-zero/api';
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/vue-table';

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

// Same reason as above: the column headers are looked up by column id, so the keys have to appear
// literally somewhere for the i18n tooling to see them.
const COLUMN_LABEL_KEYS: Readonly<Record<string, string>> = {
  occurredAt: 'dashboard.audit.table.columns.time',
  actor: 'dashboard.audit.table.columns.actor',
  action: 'dashboard.audit.table.columns.action',
  subject: 'dashboard.audit.table.columns.subject',
  outcome: 'dashboard.audit.table.columns.outcome',
};

const SORT_ICONS = {
  asc: 'lucide:arrow-up',
  desc: 'lucide:arrow-down',
  none: 'lucide:chevrons-up-down',
} as const;

/** Total lookups: `noUncheckedIndexedAccess` is on, and a column without a label is a bug, not a
 * blank header — falling back to the id makes that visible instead of rendering nothing. */
function columnLabelKey(id: string): string {
  return COLUMN_LABEL_KEYS[id] ?? id;
}

function sortIcon(direction: false | 'asc' | 'desc'): string {
  return SORT_ICONS[direction || 'none'] ?? SORT_ICONS.none;
}

const errorMessageKey = computed(() =>
  props.error ? ERROR_MESSAGE_KEYS[props.error] : ERROR_MESSAGE_KEYS.generic,
);

/** Metadata rendered as one line; the durable record keeps the structure. */
function details(entry: AuditEvent): string {
  return Object.entries(entry.metadata ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(' · ');
}

function subjectLabel(entry: AuditEvent): string {
  return entry.subject ? `${entry.subject.type}:${entry.subject.id}` : '';
}

// Registered explicitly: v9 ships no row models by default, and a feature that is not listed here
// leaves its state atoms undefined rather than silently doing nothing.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  columnVisibilityFeature,
});

// `occurredAt` is ISO-8601, so lexicographic text sorting is already chronological — no Date
// parsing per comparison. The trailing `search` column is never rendered; it exists so one filter
// box can match across every field the reader can see, which v9 has no global filter for.
const columns = [
  { id: 'occurredAt', accessorKey: 'occurredAt', sortFn: 'text' as const },
  { id: 'actor', accessorFn: (entry: AuditEvent) => entry.actor.name, sortFn: 'text' as const },
  { id: 'action', accessorKey: 'action', sortFn: 'text' as const },
  { id: 'subject', accessorFn: subjectLabel, sortFn: 'text' as const },
  { id: 'outcome', accessorKey: 'outcome', sortFn: 'text' as const },
  {
    id: 'search',
    accessorFn: (entry: AuditEvent) =>
      [
        entry.actor.name,
        entry.actor.kind,
        entry.action,
        subjectLabel(entry),
        entry.outcome,
        details(entry),
      ].join(' '),
    filterFn: 'includesString' as const,
    enableSorting: false,
  },
];

const data = computed(() => props.events);

const table = useTable({
  features,
  columns,
  data,
  // The endpoint already pages newest-first; stating it here keeps that true once the reader has
  // sorted by another column and sorted back.
  initialState: {
    sorting: [{ id: 'occurredAt', desc: true }],
    columnVisibility: { search: false },
  },
});

const headers = computed(() => table.getHeaderGroups()[0]?.headers ?? []);
const rows = computed(() => table.getRowModel().rows);
const visibleCount = computed(() => rows.value.length);

const query = ref('');
watch(query, (value) => {
  table.getColumn('search')?.setFilterValue(value);
});

function ariaSort(direction: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  if (direction === 'asc') return 'ascending';
  if (direction === 'desc') return 'descending';
  return 'none';
}

const filterInput = useTemplateRef<HTMLInputElement>('filterInput');

/** Lets the page's `/` shortcut put the caret in the filter without reaching into the DOM. */
function focusFilter(): void {
  filterInput.value?.focus();
}

defineExpose({ focusFilter });
</script>
