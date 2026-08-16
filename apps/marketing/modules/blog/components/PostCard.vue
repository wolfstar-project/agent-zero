<template>
  <li class="card flex flex-col">
    <p class="m-0 flex items-center gap-3 text-xs text-muted">
      <time :datetime="post.date">{{ formattedDate }}</time>
      <span
        class="border border-line px-2 py-0.5 text-3xs text-muted font-650 tracking-wider uppercase"
      >
        {{ post.tag }}
      </span>
    </p>

    <h2 class="m-0 mt-3 text-base font-700">
      <NuxtLink class="focus-ring transition hover:text-accent" :to="localePath(post.path)">
        {{ post.title }}
      </NuxtLink>
    </h2>

    <p class="m-0 mt-2 flex-1 text-sm text-muted leading-relaxed">{{ post.description }}</p>

    <div class="mt-6 flex items-center gap-3">
      <span
        class="h-8 w-8 grid shrink-0 place-items-center border border-line bg-raised mono text-muted"
        aria-hidden="true"
      >
        {{ post.authorInitials }}
      </span>
      <span class="min-w-0 truncate text-sm font-650">{{ post.author }}</span>
      <NuxtLink
        class="focus-ring ms-auto shrink-0 text-xs text-link font-650"
        :to="localePath(post.path)"
      >
        {{ $t('marketing.pages.blog.readMore') }} →
      </NuxtLink>
    </div>
  </li>
</template>

<script setup lang="ts">
const { locale } = useI18n();
const localePath = useLocalePath();

const { post } = defineProps<{
  post: {
    path: string;
    title: string;
    description: string;
    date: string;
    author: string;
    authorInitials: string;
    tag: string;
  };
}>();

// The post itself ships in English only (see content.config.ts); the date still renders in the
// visitor's own locale format, since that much doesn't require a translated document.
const formattedDate = computed(() =>
  new Date(post.date).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
);
</script>
