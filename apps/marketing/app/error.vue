<template>
  <div class="min-h-screen flex items-center justify-center px-5 text-ink">
    <NuxtRouteAnnouncer />
    <ErrorPage :error />
  </div>
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

// error.vue replaces the app root on fatal errors — ensure the active locale (including the
// dedicated errors feature file) is loaded before we translate.
const { t, locale, loadLocaleMessages } = useI18n({ useScope: 'global' });
await loadLocaleMessages(locale.value);

const statusCode = computed(() => resolveErrorStatus(error));
const isNotFound = computed(() => isNotFoundStatus(statusCode.value));
const isServerError = computed(() => isServerErrorStatus(statusCode.value));

const seoTitle = computed(() => {
  // Mirrors ErrorPage.vue's title branching: a 5xx always gets the friendly translated label here
  // too, rather than leaking a raw statusText/statusMessage into the page's indexed <title> tag.
  const label = isNotFound.value
    ? t('errors.not_found_title')
    : isServerError.value
      ? t('errors.server_error_title')
      : error.statusText || error.statusMessage || t('errors.server_error_title');
  return `${statusCode.value} · ${label}`;
});

const seoDescription = computed(() => {
  if (isNotFound.value) return t('errors.not_found_description');
  if (isServerError.value) return t('errors.server_error');
  return t('errors.generic_description');
});

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  robots: 'noindex, nofollow',
});
</script>
