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
      <NuxtLink class="focus-ring transition hover:text-accent" :to="postPath">
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
      <NuxtLink class="focus-ring ms-auto shrink-0 text-xs text-link font-650" :to="postPath">
        {{ $t("marketing.pages.blog.readMore") }} →
      </NuxtLink>
    </div>
  </li>
</template>

<script setup lang="ts">
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

// `post.path` comes straight from `@nuxt/content` (e.g. `/blog/foo`) with no locale prefix; under
// `prefix_except_default` an `it` visitor following it unresolved would land back on the English
// route and lose their locale.
const postPath = computed(() => localePath(post.path));
const dateFormatter = useDateFormatter({ year: "numeric", month: "long", day: "numeric" });
const formattedDate = computed(() => dateFormatter.value.format(new Date(post.date)));
</script>
