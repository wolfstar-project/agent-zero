<template>
  <article class="section-y">
    <div class="shell max-w-3xl">
      <div v-if="$slots.before" class="mb-6">
        <slot name="before" />
      </div>

      <p class="m-0 flex items-center gap-3 text-xs text-muted">
        <time :datetime="post.date">{{ formattedDate }}</time>
        <span
          class="border border-line px-2 py-0.5 text-3xs text-muted font-650 tracking-wider uppercase"
        >
          {{ post.tag }}
        </span>
      </p>

      <h1 class="m-0 mt-3 text-headline font-750 tracking-tight">{{ post.title }}</h1>

      <div class="mt-6 flex items-center gap-3">
        <span
          class="h-9 w-9 grid shrink-0 place-items-center border border-line bg-raised mono text-muted"
          aria-hidden="true"
        >
          {{ post.authorInitials }}
        </span>
        <span class="text-sm font-650">{{ post.author }}</span>
      </div>

      <div class="prose mt-8 max-w-none text-sm text-muted leading-relaxed">
        <ContentRenderer :value="post" />
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
const { post } = defineProps<{
  post: {
    title: string;
    description: string;
    date: string;
    author: string;
    authorInitials: string;
    tag: string;
  };
}>();

const dateFormatter = useDateFormatter({ year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const formattedDate = computed(() => dateFormatter.value.format(new Date(post.date)));
</script>
