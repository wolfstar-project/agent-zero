<template>
  <section class="panel overflow-hidden">
    <div class="section-title">
      <div class="flex items-center gap-2">
        <h2 class="m-0 text-xs font-750 tracking-[0.12em] uppercase">
          {{ $t('dashboard.queue.title') }}
        </h2>
        <span class="border border-line bg-raised px-1.5 py-0.5 mono text-muted">
          {{ tasks.length }}
        </span>
      </div>
      <span class="mono text-muted">{{ $t('dashboard.queue.order') }}</span>
    </div>

    <div v-if="tasks.length > 0" class="overflow-x-auto">
      <table class="w-full min-w-160 border-collapse text-start">
        <thead>
          <tr class="border-b border-line bg-raised/55">
            <th class="px-3.5 py-2.5 label-upper">
              {{ $t('dashboard.queue.columns.id') }}
            </th>
            <th class="px-3.5 py-2.5 label-upper">
              {{ $t('dashboard.queue.columns.repository') }}
            </th>
            <th class="px-3.5 py-2.5 label-upper">
              {{ $t('dashboard.queue.columns.status') }}
            </th>
            <th class="px-3.5 py-2.5 label-upper">
              {{ $t('dashboard.queue.columns.updated') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in tasks"
            :key="task.id"
            tabindex="0"
            class="cursor-pointer border-b border-line/70 transition last:border-b-0 hover:bg-raised/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
            :class="selectedId === task.id ? 'bg-accent/5' : ''"
            @click="$emit('select', task.id)"
            @keydown.enter="$emit('select', task.id)"
          >
            <td class="px-3.5 py-3 font-mono text-xs text-link">{{ shortId(task.id) }}</td>
            <td class="px-3.5 py-3">
              <p class="m-0 text-xs font-650">{{ repositoryName(task.repository) }}</p>
              <p class="m-0 mt-1 max-w-72 truncate font-mono text-3xs text-muted">
                {{ task.repository }}
              </p>
            </td>
            <td class="px-3.5 py-3"><TaskStatus :status="task.status" /></td>
            <td class="px-3.5 py-3 font-mono text-3xs text-muted">
              {{ new Date(task.updatedAt).toLocaleString(locale) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="min-h-52 grid place-items-center px-5 py-10 text-center">
      <div>
        <div class="mx-auto h-9 w-9 grid place-items-center border border-line bg-raised">
          <Icon aria-hidden="true" class="h-4 w-4 text-muted" name="lucide:inbox" />
        </div>
        <h3 class="mb-0 mt-4 text-sm font-650">{{ $t('dashboard.queue.emptyTitle') }}</h3>
        <p class="mx-auto mb-0 mt-2 max-w-80 text-xs text-muted leading-relaxed">
          {{ $t('dashboard.queue.emptyBody') }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DashboardTask } from '~~/modules/dashboard/types/dashboard';

defineProps<{ tasks: DashboardTask[]; selectedId?: string }>();
defineEmits<{ select: [id: string] }>();

const { locale } = useI18n();

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function repositoryName(repository: string): string {
  const normalized = repository.replaceAll('\\', '/');
  return normalized.split('/').findLast((segment) => segment.length > 0) ?? repository;
}
</script>
