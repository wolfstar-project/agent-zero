<script setup lang="ts">
import type { DashboardTask } from '#shared/dashboard';

defineProps<{ tasks: DashboardTask[]; selectedId?: string }>();
defineEmits<{ select: [id: string] }>();

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function repositoryName(repository: string): string {
  const normalized = repository.replaceAll('\\', '/');
  return normalized.split('/').findLast((segment) => segment.length > 0) ?? repository;
}
</script>

<template>
  <section class="az-panel overflow-hidden">
    <div class="az-section-title">
      <div class="flex items-center gap-2">
        <h2 class="m-0 text-xs font-750 tracking-[0.12em] uppercase">Task queue</h2>
        <span class="border border-line bg-raised px-1.5 py-0.5 az-mono text-muted">
          {{ tasks.length }}
        </span>
      </div>
      <span class="az-mono text-muted">Newest first</span>
    </div>

    <div v-if="tasks.length > 0" class="overflow-x-auto">
      <table class="w-full min-w-160 border-collapse text-left">
        <thead>
          <tr class="border-b border-line bg-raised/55">
            <th class="px-3.5 py-2.5 text-[9px] text-muted font-700 tracking-wider uppercase">
              ID
            </th>
            <th class="px-3.5 py-2.5 text-[9px] text-muted font-700 tracking-wider uppercase">
              Repository
            </th>
            <th class="px-3.5 py-2.5 text-[9px] text-muted font-700 tracking-wider uppercase">
              Status
            </th>
            <th class="px-3.5 py-2.5 text-[9px] text-muted font-700 tracking-wider uppercase">
              Updated
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
              <p class="m-0 mt-1 max-w-72 truncate font-mono text-[10px] text-muted">
                {{ task.repository }}
              </p>
            </td>
            <td class="px-3.5 py-3"><TaskStatus :status="task.status" /></td>
            <td class="px-3.5 py-3 font-mono text-[10px] text-muted">
              {{ new Date(task.updatedAt).toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="min-h-52 grid place-items-center px-5 py-10 text-center">
      <div>
        <div class="mx-auto h-9 w-9 grid place-items-center border border-line bg-raised">
          <span class="h-2 w-2 border border-muted" />
        </div>
        <h3 class="mb-0 mt-4 text-sm font-650">No tasks recorded</h3>
        <p class="mx-auto mb-0 mt-2 max-w-80 text-xs text-muted leading-relaxed">
          Submitted control-plane tasks appear here with their durable execution history.
        </p>
      </div>
    </div>
  </section>
</template>
