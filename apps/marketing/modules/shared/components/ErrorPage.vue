<template>
  <section class="panel w-full max-w-md p-8" aria-labelledby="error-page-title">
    <p class="m-0 mono text-muted">
      <span class="sr-only">{{ t('common.error') }}&nbsp;</span>{{ status }}
    </p>
    <h1 id="error-page-title" class="m-0 mt-2 text-xl font-750 tracking-tight">{{ title }}</h1>
    <p class="mb-8 mt-2 text-sm text-muted leading-relaxed">{{ description }}</p>

    <p v-if="detail" class="mb-8 mono break-all border border-line bg-raised p-3 text-muted">
      {{ detail }}
    </p>

    <div class="flex flex-wrap gap-3">
      <button v-if="!isNotFound" class="btn btn-accent" type="button" @click="retry">
        {{ t('common.retry') }}
      </button>
      <button class="btn btn-subtle" type="button" @click="goHome">
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
} from '~~/modules/shared/utils/error-status';

const { error } = defineProps<{
  error: NuxtError;
}>();

const { t } = useI18n({ useScope: 'global' });
const localePath = useLocalePath();

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
  // Back to the home page of the locale the visitor was already reading, not the default one.
  await clearError({ redirect: localePath('/') });
}
</script>
