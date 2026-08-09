<script setup lang="ts">
import type { DashboardTask } from '~/types/dashboard';

defineProps<{ task?: DashboardTask }>();
</script>

<template>
  <aside class="az-panel min-h-120 overflow-hidden xl:sticky xl:top-20 xl:h-fit">
    <div class="az-section-title">
      <h2 class="m-0 text-xs font-750 tracking-[0.12em] uppercase">Task inspector</h2>
      <span class="h-1.5 w-1.5 rounded-full" :class="task ? 'bg-accent' : 'bg-muted'" />
    </div>

    <div v-if="task" class="p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="m-0 az-mono text-link">{{ task.id }}</p>
          <p class="m-0 mt-1 truncate text-xs text-muted">{{ task.repository }}</p>
        </div>
        <TaskStatus :status="task.status" />
      </div>

      <dl class="my-4 grid grid-cols-2 border border-line">
        <div class="border-b border-r border-line p-3">
          <dt class="text-[9px] text-muted font-700 tracking-wider uppercase">Created</dt>
          <dd class="mb-0 ml-0 mt-1.5 font-mono text-[10px] text-ink">
            {{ new Date(task.createdAt).toLocaleString() }}
          </dd>
        </div>
        <div class="border-b border-line p-3">
          <dt class="text-[9px] text-muted font-700 tracking-wider uppercase">Attempts</dt>
          <dd class="mb-0 ml-0 mt-1.5 font-mono text-[10px] text-ink">
            {{ task.result?.attempts ?? '—' }}
          </dd>
        </div>
        <div class="border-r border-line p-3">
          <dt class="text-[9px] text-muted font-700 tracking-wider uppercase">Tokens</dt>
          <dd class="mb-0 ml-0 mt-1.5 font-mono text-[10px] text-ink">
            {{ task.result?.usage.totalTokens.toLocaleString() ?? '—' }}
          </dd>
        </div>
        <div class="p-3">
          <dt class="text-[9px] text-muted font-700 tracking-wider uppercase">Verified</dt>
          <dd
            class="mb-0 ml-0 mt-1.5 font-mono text-[10px]"
            :class="task.result?.verified ? 'text-accent' : 'text-muted'"
          >
            {{ task.result ? (task.result.verified ? 'YES' : 'NO') : '—' }}
          </dd>
        </div>
      </dl>

      <div v-if="task.result" class="border border-line bg-raised/45 p-3">
        <p class="m-0 text-[9px] text-muted font-700 tracking-wider uppercase">Run summary</p>
        <p class="mb-0 mt-2 text-xs text-ink leading-relaxed">{{ task.result.summary }}</p>
      </div>
    </div>

    <div v-else class="min-h-120 grid place-items-center px-6 text-center">
      <div>
        <div class="mx-auto h-10 w-10 grid place-items-center border border-line bg-raised">
          <svg aria-hidden="true" class="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="1.5" />
            <path d="m16 16 4 4" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </div>
        <h3 class="mb-0 mt-4 text-sm font-650">No task selected</h3>
        <p class="mb-0 mt-2 text-xs text-muted leading-relaxed">
          Select a queue record to inspect evidence and usage.
        </p>
      </div>
    </div>
  </aside>
</template>
