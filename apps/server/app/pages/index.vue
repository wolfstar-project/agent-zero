<script setup lang="ts">
import type { ApprovalDecision, DashboardOverview } from '#shared/dashboard';

const emptyOverview = (): DashboardOverview => ({
  tasks: [],
  active: 0,
  queued: 0,
  awaitingApproval: 0,
  totalTokens: 0,
  costUsd: 0,
});

const { data, error, refresh, status } = await useFetch<DashboardOverview>('/api/dashboard', {
  default: emptyOverview,
  key: 'control-plane-dashboard',
});
const selectedId = ref<string>();
const decisionPending = ref(false);
const decisionError = ref<string>();
const now = ref(new Date());

const overview = computed(() => data.value ?? emptyOverview());
const selectedTask = computed(() =>
  overview.value.tasks.find((task) => task.id === selectedId.value),
);

watch(
  () => overview.value.tasks,
  (tasks) => {
    if (tasks.length === 0) selectedId.value = undefined;
    else if (!tasks.some((task) => task.id === selectedId.value)) selectedId.value = tasks[0]?.id;
  },
  { immediate: true },
);

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  refreshTimer = setInterval(() => void refresh(), 5_000);
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1_000);
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  if (clockTimer) clearInterval(clockTimer);
});

async function decide(decision: ApprovalDecision, comment: string): Promise<void> {
  if (!selectedTask.value) return;
  decisionPending.value = true;
  decisionError.value = undefined;
  try {
    await $fetch(`/api/tasks/${encodeURIComponent(selectedTask.value.id)}/approval`, {
      method: 'POST',
      body: {
        actor: 'dashboard',
        comment: comment.trim() || undefined,
        decision,
      },
    });
    await refresh();
  } catch (cause) {
    decisionError.value = cause instanceof Error ? cause.message : 'Approval update failed';
  } finally {
    decisionPending.value = false;
  }
}
</script>

<template>
  <header
    class="h-16 flex items-center justify-between border-b border-line bg-canvas/92 px-4 backdrop-blur md:px-6"
  >
    <div>
      <p class="m-0 text-3xs text-muted font-700 tracking-[0.18em] uppercase">
        Agent Zero / Operations
      </p>
      <h1 class="m-0 mt-1 text-lg font-650 tracking-tight">Control plane</h1>
    </div>

    <div class="flex items-center gap-3">
      <div class="hidden text-end sm:block">
        <p class="m-0 az-mono text-muted">{{ now.toISOString().slice(0, 19) }}Z</p>
        <p class="m-0 mt-0.5 text-3xs text-accent font-700 tracking-wider uppercase">
          Live telemetry
        </p>
      </div>
      <button
        class="az-focus h-9 flex items-center gap-2 border border-line bg-raised px-3 text-xs text-ink font-650 transition hover:border-muted disabled:cursor-wait disabled:opacity-60"
        :disabled="status === 'pending'"
        type="button"
        @click="refresh()"
      >
        <svg aria-hidden="true" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <path d="M20 7v5h-5M4 17v-5h5" stroke="currentColor" stroke-width="1.8" />
          <path
            d="M18.2 9A7 7 0 0 0 6.1 6.6L4 9m2 6a7 7 0 0 0 12.1 2.4L20 15"
            stroke="currentColor"
            stroke-width="1.8"
          />
        </svg>
        Refresh
      </button>
    </div>
  </header>

  <div class="p-3 sm:p-4 md:p-5">
    <div
      v-if="error"
      role="alert"
      class="mb-4 border border-danger/45 bg-danger/8 px-3 py-2 az-mono text-danger"
    >
      Dashboard unavailable: {{ error.message }}
    </div>

    <RunnerMetrics :overview="overview" />

    <section class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="min-w-0 space-y-4">
        <TaskTable
          :tasks="overview.tasks"
          :selected-id="selectedId"
          @select="selectedId = $event"
        />
        <TaskTimeline :task="selectedTask" />
      </div>

      <TaskInspector
        :task="selectedTask"
        :pending="decisionPending"
        :error="decisionError"
        @decide="decide"
      />
    </section>
  </div>
</template>
