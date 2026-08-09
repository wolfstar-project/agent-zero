<script setup lang="ts">
const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === 'dark');
const label = computed(() => `Switch to ${isDark.value ? 'light' : 'dark'} mode`);

function toggleColorMode(): void {
  colorMode.preference = isDark.value ? 'light' : 'dark';
}
</script>

<template>
  <button
    class="az-focus h-9 w-9 grid place-items-center border border-line bg-raised text-ink transition hover:border-muted"
    type="button"
    :aria-label="label"
    :title="label"
    @click="toggleColorMode"
  >
    <svg v-if="isDark" aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.7" />
      <path
        d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56m11.02 11.02 1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.7"
      />
    </svg>
    <svg v-else aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.2 15.2A8.2 8.2 0 0 1 8.8 3.8 8.2 8.2 0 1 0 20.2 15.2Z"
        stroke="currentColor"
        stroke-linejoin="round"
        stroke-width="1.7"
      />
    </svg>
  </button>
</template>
