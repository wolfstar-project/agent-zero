<template>
  <article v-if="post" class="section-y">
    <div class="shell max-w-3xl">
      <NuxtLink class="focus-ring text-xs text-link font-650" :to="localePath('/blog')">
        ← {{ $t('marketing.pages.blog.backToBlog') }}
      </NuxtLink>

      <p class="m-0 mt-6 flex items-center gap-3 text-xs text-muted">
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
const route = useRoute();
const { locale } = useI18n();
const localePath = useLocalePath();

const slug = computed(() => String(route.params.slug));

// `watch: [slug]` refetches when navigating from one post straight to another: the route matches
// the same page component, so Vue reuses the instance and only `route.params.slug` changes —
// without it `post` would keep showing the previous article's content.
const { data: post, status } = await useAsyncData(
  `blog-post-${slug.value}`,
  () => queryCollection('blog').path(`/blog/${slug.value}`).first(),
  { watch: [slug] },
);

// A one-time `!post.value` check right after the `await` above only covers the initial load: once
// `watch: [slug]` refetches for a reused page instance, an unknown slug would otherwise leave
// `post` at `null` with no error thrown, and `v-if="post"` would silently render a blank page
// instead of the 404. Watching `status` with `immediate: true` covers both the first load and
// every later refetch through the one check.
watch(
  status,
  (value) => {
    if (value === 'success' && !post.value) {
      showError(createError({ statusCode: 404, statusMessage: 'Not found' }));
    }
  },
  { immediate: true },
);

const formattedDate = computed(() =>
  new Date(post.value?.date ?? '').toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
);

useSeoMeta({
  title: () => post.value?.title,
  description: () => post.value?.description,
  ogTitle: () => post.value?.title,
  ogDescription: () => post.value?.description,
  articleAuthor: () => (post.value?.author ? [post.value.author] : undefined),
  articlePublishedTime: () => post.value?.date,
});
</script>
