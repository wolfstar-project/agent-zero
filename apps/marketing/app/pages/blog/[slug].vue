<template>
  <BlogPost v-if="post" :post="post">
    <template #before>
      <NuxtLink class="focus-ring text-xs text-link font-650" :to="localePath({ path: '/blog' })">
        ← {{ $t("marketing.pages.blog.backToBlog") }}
      </NuxtLink>
    </template>
  </BlogPost>
</template>

<script setup lang="ts">
const route = useRoute<'blog-slug'>();
const localePath = useLocalePath();

const slug = computed(() => String(route.params.slug));

// `watch: [slug]` refetches when navigating from one post straight to another: the route matches
// the same page component, so Vue reuses the instance and only `route.params.slug` changes —
// without it `post` would keep showing the previous article's content.
const { data: post, status } = await useAsyncData(
  `blog-post-${slug.value}`,
  () => queryCollection("blog").path(`/blog/${slug.value}`).first(),
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
    if (value === "success" && !post.value) {
      showError(createError({ statusCode: 404, statusMessage: "Not found" }));
    }
  },
  { immediate: true },
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
