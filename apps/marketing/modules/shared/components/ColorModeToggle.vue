<template>
  <button
    class="btn-icon"
    type="button"
    :aria-label="label"
    :title="label"
    @click="toggleColorMode"
  >
    <Icon aria-hidden="true" class="h-4 w-4" :name="isDark ? 'lucide:sun' : 'lucide:moon'" />
  </button>
</template>

<script setup lang="ts">
// The rendered icon depends on a preference that only exists in the browser, so every call site
// wraps this in <ClientOnly>; rendering it on the server would guarantee a hydration mismatch.
const { t } = useI18n();
const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === 'dark');
const label = computed(() =>
  isDark.value ? t('common.theme.switchToLight') : t('common.theme.switchToDark'),
);

function toggleColorMode(): void {
  colorMode.preference = isDark.value ? 'light' : 'dark';
}
</script>
