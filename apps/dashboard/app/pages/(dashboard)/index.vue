<template>
  <header
    class="h-16 flex items-center justify-between border-b border-line bg-canvas/92 px-4 backdrop-blur md:px-6"
  >
    <div>
      <p class="m-0 text-3xs text-muted font-700 tracking-[0.18em] uppercase">
        {{ $t('dashboard.header.eyebrow') }}
      </p>
      <h1 class="m-0 mt-1 text-lg font-650 tracking-tight">{{ $t('dashboard.header.title') }}</h1>
    </div>

    <div class="flex items-center gap-3">
      <div class="hidden h-9 items-center gap-2 border border-line bg-raised px-3 lg:flex">
        <span class="label-upper">{{ $t('dashboard.header.mode') }}</span>
      </div>
      <ClientOnly>
        <div class="hidden h-9 items-center gap-2 border border-line bg-raised px-3 sm:flex">
          <Icon aria-hidden="true" class="h-3.5 w-3.5 text-muted" name="lucide:clock-3" />
          <span class="mono text-ink">{{ now.toISOString().slice(0, 19) }}Z</span>
        </div>
      </ClientOnly>
      <LocaleSwitcher />
      <ClientOnly>
        <ColorModeToggle />
        <template #fallback>
          <span class="h-9 w-9 border border-line bg-raised" aria-hidden="true" />
        </template>
      </ClientOnly>
      <button class="btn-subtle gap-2 px-3" type="button" @click="refreshDashboard">
        <Icon aria-hidden="true" class="h-3.5 w-3.5" name="lucide:refresh-cw" />
        {{ $t('common.actions.refresh') }}
      </button>
      <div
        aria-hidden="true"
        class="h-9 w-9 hidden place-items-center border border-accent/45 bg-accent/8 font-mono text-xs text-accent font-700 sm:grid"
      >
        AZ
      </div>
    </div>
  </header>

  <div class="p-3 sm:p-4 md:p-5">
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

      <TaskInspector :task="selectedTask" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import type { DashboardOverview } from '~~/modules/dashboard/types/dashboard';

/**
 * What the page renders before the first response arrives, and after a failed one.
 *
 * The components below take a populated shape rather than a nullable one, so the empty overview is
 * a real value instead of a `v-if` around the whole page: an operator whose control plane is
 * unreachable still gets the shell and the zero counters, not a blank screen.
 */
const emptyOverview = (): DashboardOverview => ({
  tasks: [],
  active: 0,
  queued: 0,
  awaitingApproval: 0,
  totalTokens: 0,
  costUsd: 0,
});

/**
 * The aggregate read model, fetched through the typed oRPC client.
 *
 * `useQuery` rather than `useSuspenseQuery`, so the server render does not block on the control
 * plane: the first paint is the shell with zero counters and the data arrives after hydration.
 * That is the deliberate trade — a slow or unreachable control plane must not hold up the whole
 * document — and it is why `emptyOverview()` above is a real value rather than a nullable one.
 *
 * `$orpcQuery` is provided by `app/plugins/orpc.client.ts`; its `orpc.server.ts` twin exists for
 * the same key during SSR, and matters for anything that *does* fetch server-side, since it is the
 * half that forwards the request's cookie.
 */
const { $orpcQuery } = useNuxtApp();
const { data, refetch } = useQuery($orpcQuery.dashboard.overview.queryOptions());

const overview = computed<DashboardOverview>(() => data.value ?? emptyOverview());
const selectedId = ref<string>();
const now = ref(new Date());

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

let clockTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1_000);
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
});

/** Refetches rather than clearing: the button says refresh, and it used to only blank the page. */
function refreshDashboard(): void {
  now.value = new Date();
  void refetch();
}
</script>
