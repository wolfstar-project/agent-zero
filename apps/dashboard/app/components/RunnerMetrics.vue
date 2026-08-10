<template>
  <section :aria-label="$t('dashboard.metrics.aria')" class="panel grid grid-cols-2 lg:grid-cols-5">
    <div
      v-for="(metric, index) in metrics"
      :key="metric.label"
      class="min-h-24 flex flex-col justify-between border-line p-3.5 sm:p-4"
      :class="[
        index % 2 === 0 ? 'border-r' : '',
        index < 4 ? 'border-b lg:border-b-0 lg:border-r' : '',
      ]"
    >
      <p class="m-0 text-[9px] text-muted font-700 tracking-[0.16em] uppercase">
        {{ metric.label }}
      </p>
      <p class="m-0 mt-3 font-mono text-2xl font-600 tracking-tight" :class="metric.tone">
        {{ metric.value }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DashboardOverview } from '~/types/dashboard';

const props = defineProps<{ overview: DashboardOverview }>();

const { t, locale } = useI18n();

const metrics = computed(() => [
  {
    label: t('dashboard.metrics.activeRunners'),
    value: props.overview.active.toString(),
    tone: 'text-accent',
  },
  {
    label: t('dashboard.metrics.queuedTasks'),
    value: props.overview.queued.toString(),
    tone: 'text-ink',
  },
  {
    label: t('dashboard.metrics.awaitingApproval'),
    value: props.overview.awaitingApproval.toString(),
    tone: props.overview.awaitingApproval > 0 ? 'text-warning' : 'text-ink',
  },
  {
    label: t('dashboard.metrics.tokens'),
    value: props.overview.totalTokens.toLocaleString(locale.value),
    tone: 'text-ink',
  },
  {
    label: t('dashboard.metrics.recordedCost'),
    value: `$${props.overview.costUsd.toFixed(4)}`,
    tone: 'text-ink',
  },
]);
</script>
