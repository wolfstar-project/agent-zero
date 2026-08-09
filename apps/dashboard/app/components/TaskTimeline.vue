<script setup lang="ts">
import type { DashboardTask } from '~/types/dashboard';

defineProps<{ task?: DashboardTask }>();
</script>

<template>
  <section class="az-panel">
    <div class="az-section-title">
      <h2 class="m-0 text-xs font-750 tracking-[0.12em] uppercase">Execution timeline</h2>
      <span class="az-mono text-muted">{{ task?.events.length ?? 0 }} events</span>
    </div>

    <div v-if="task && task.events.length > 0" class="max-h-72 overflow-auto px-4 py-3">
      <ol class="m-0 list-none p-0">
        <li
          v-for="(event, index) in task.events"
          :key="`${event.timestamp}-${index}`"
          class="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-3 pb-4 last:pb-1"
        >
          <div
            v-if="index < task.events.length - 1"
            class="absolute bottom-0 left-[0.218rem] top-3 w-px bg-line"
          />
          <span class="relative mt-1.5 h-2 w-2 border border-accent bg-panel" />
          <div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="m-0 font-mono text-[10px] text-accent font-700 uppercase">
                {{ event.state }}
              </p>
              <time class="font-mono text-[9px] text-muted">{{ event.timestamp }}</time>
            </div>
            <p class="mb-0 mt-1 text-xs text-muted leading-relaxed">{{ event.message }}</p>
          </div>
        </li>
      </ol>
    </div>

    <div v-else class="h-30 flex items-center justify-center px-4 text-center text-xs text-muted">
      Select a task to inspect its state transitions.
    </div>
  </section>
</template>
