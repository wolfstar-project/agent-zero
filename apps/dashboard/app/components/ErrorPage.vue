<template>
  <section class="az-panel w-full max-w-88 p-6" aria-labelledby="error-page-title">
    <p class="m-0 az-mono text-muted">
      <span class="sr-only">{{ t('common.error') }}&nbsp;</span>{{ status }}
    </p>
    <h1 id="error-page-title" class="m-0 mt-2 text-lg font-650 tracking-tight">{{ title }}</h1>
    <p class="mb-6 mt-1 text-xs text-muted">{{ description }}</p>

    <p v-if="detail" class="mb-6 az-mono break-all border border-line bg-raised p-2.5 text-muted">
      {{ detail }}
    </p>

    <div class="flex flex-col gap-3">
      <button
        v-if="!isNotFound"
        class="az-focus h-9 flex items-center justify-center border border-accent/45 bg-accent/8 text-xs text-ink font-650 transition hover:border-accent"
        type="button"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
      <button
        class="az-focus h-9 flex items-center justify-center border border-line bg-raised text-xs text-ink font-650 transition hover:border-muted"
        type="button"
        @click="goHome"
      >
        {{ t('errors.back_to_home') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { NuxtError } from 'nuxt/app';

import {
  isNotFoundStatus,
  isServerErrorStatus,
  resolveErrorStatus,
} from '#shared/utils/error-status';

const { error } = defineProps<{
  error: NuxtError;
}>();

const { t } = useI18n({ useScope: 'global' });

const status = computed(() => resolveErrorStatus(error));
const isNotFound = computed(() => isNotFoundStatus(status.value));
const isServerError = computed(() => isServerErrorStatus(status.value));

const title = computed(() => {
  if (isNotFound.value) return t('errors.not_found_title');
  if (isServerError.value) return t('errors.server_error_title');
  return error.statusText || error.statusMessage || t('errors.generic_title');
});

const description = computed(() => {
  if (isNotFound.value) return t('errors.not_found_description');
  if (isServerError.value) return t('errors.server_error');
  return t('errors.generic_description');
});

const detail = computed(() => {
  // 404 already has friendly copy; server errors may carry raw internal messages, so surface them
  // only in development — never in production.
  if (isNotFound.value || !import.meta.dev) return undefined;
  return error.message;
});

function retry(): void {
  reloadNuxtApp();
}

async function goHome(): Promise<void> {
  await clearError({ redirect: '/' });
}
</script>
