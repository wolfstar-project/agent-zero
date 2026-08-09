<script setup lang="ts">
import type { ApprovalDecision, DashboardTask } from '#shared/dashboard';

const props = defineProps<{ task?: DashboardTask; pending: boolean; error?: string }>();
const emit = defineEmits<{ decide: [decision: ApprovalDecision, comment: string] }>();
const comment = ref('');

watch(
  () => props.task?.id,
  () => {
    comment.value = '';
  },
);

function decide(decision: ApprovalDecision): void {
  emit('decide', decision, comment.value);
}
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

      <div v-if="task.status === 'needs-human' && !task.approval" class="mt-4">
        <label
          for="approval-comment"
          class="text-[9px] text-warning font-700 tracking-[0.15em] uppercase"
        >
          Human decision required
        </label>
        <textarea
          id="approval-comment"
          v-model="comment"
          class="az-focus mt-2 min-h-24 w-full resize-y border border-line bg-canvas p-3 text-xs text-ink placeholder:text-muted"
          maxlength="1000"
          placeholder="Optional decision context…"
        />
        <p v-if="error" role="alert" class="mb-0 mt-2 text-[10px] text-danger">{{ error }}</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button
            class="az-focus h-10 flex items-center justify-center gap-2 border border-danger/50 bg-danger/8 text-xs text-danger font-700 transition hover:bg-danger/15 disabled:cursor-wait disabled:opacity-50"
            :disabled="pending"
            type="button"
            @click="decide('rejected')"
          >
            <svg aria-hidden="true" class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
              <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" stroke-width="1.7" />
            </svg>
            Reject
          </button>
          <button
            class="az-focus h-10 flex items-center justify-center gap-2 border border-accent/50 bg-accent/8 text-xs text-accent font-700 transition hover:bg-accent/15 disabled:cursor-wait disabled:opacity-50"
            :disabled="pending"
            type="button"
            @click="decide('approved')"
          >
            <svg aria-hidden="true" class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
              <path d="m3 8.5 3.2 3.2L13 5" stroke="currentColor" stroke-width="1.7" />
            </svg>
            Approve
          </button>
        </div>
      </div>

      <div v-else-if="task.approval" class="mt-4 border border-line p-3">
        <p class="m-0 text-[9px] text-muted font-700 tracking-wider uppercase">Decision</p>
        <p
          class="mb-0 mt-2 font-mono text-xs font-700 uppercase"
          :class="task.approval.decision === 'approved' ? 'text-accent' : 'text-danger'"
        >
          {{ task.approval.decision }} by {{ task.approval.actor }}
        </p>
        <p v-if="task.approval.comment" class="mb-0 mt-2 text-xs text-muted leading-relaxed">
          {{ task.approval.comment }}
        </p>
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
          Select a queue record to inspect evidence, usage, and approvals.
        </p>
      </div>
    </div>
  </aside>
</template>
