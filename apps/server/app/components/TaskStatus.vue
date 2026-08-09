<script setup lang="ts">
import type { ControlPlaneTaskStatus } from '#shared/dashboard';

const props = defineProps<{ status: ControlPlaneTaskStatus }>();

const statusClass = computed(() => {
  if (props.status === 'completed') return 'border-accent/35 bg-accent/8 text-accent';
  if (props.status === 'needs-human') return 'border-warning/35 bg-warning/8 text-warning';
  if (props.status === 'failed') return 'border-danger/35 bg-danger/8 text-danger';
  if (props.status === 'running') return 'border-link/35 bg-link/8 text-link';
  return 'border-line bg-raised text-muted';
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] font-700 uppercase"
    :class="statusClass"
  >
    <span class="h-1.5 w-1.5 rounded-full bg-current" />
    {{ status.replace('-', ' ') }}
  </span>
</template>
