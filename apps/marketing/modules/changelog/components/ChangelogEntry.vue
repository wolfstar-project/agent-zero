<template>
  <li class="card">
    <div class="flex flex-wrap items-center gap-3">
      <span
        class="border border-accent/45 bg-accent/8 px-2 py-0.5 text-3xs text-accent font-650 tracking-wider uppercase"
      >
        {{ entry.version }}
      </span>
      <time :datetime="entry.date" class="text-xs text-muted">{{ formattedDate }}</time>
    </div>

    <h2 class="m-0 mt-3 text-lg font-750 tracking-tight">{{ entry.title }}</h2>

    <div class="prose mt-4 max-w-none text-sm text-muted leading-relaxed">
      <ContentRenderer :value="entry" />
    </div>
  </li>
</template>

<script setup lang="ts">
const { entry } = defineProps<{
  entry: {
    title: string;
    description: string;
    version: string;
    date: string;
  };
}>();

const dateFormatter = useDateFormatter({
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});
const formattedDate = computed(() => dateFormatter.value.format(new Date(entry.date)));
</script>
