<template>
  <div class="section-y">
    <div class="shell">
      <div class="max-w-2xl">
        <h1 class="m-0 text-headline font-750 tracking-tight">
          {{ $t('marketing.pages.blog.heading') }}
        </h1>
        <p class="m-0 mt-4 lede">{{ $t('marketing.pages.blog.subtitle') }}</p>
      </div>

      <div v-if="tags.length > 0" class="mt-8 flex flex-wrap items-center gap-2">
        <button
          v-for="option in ['all', ...tags]"
          :key="option"
          class="focus-ring h-8 border px-3 text-xs font-650 transition"
          :class="
            activeTag === option
              ? 'border-accent/45 bg-accent/12 text-ink'
              : 'border-line bg-raised text-muted hover:text-ink'
          "
          type="button"
          @click="activeTag = option"
        >
          {{ option === 'all' ? $t('marketing.pages.blog.allTag') : option }}
        </button>
      </div>

      <p v-if="posts && posts.length === 0" class="m-0 mt-10 text-sm text-muted">
        {{ $t('marketing.pages.blog.empty') }}
      </p>
      <ul v-else class="m-0 mt-10 grid list-none gap-4 ps-0 md:grid-cols-2 lg:grid-cols-3">
        <BlogPostCard v-for="post in filteredPosts" :key="post.path" :post="post" />
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

const { data: posts } = await useAsyncData('blog-index', () =>
  queryCollection('blog').order('date', 'DESC').all(),
);

const tags = computed(() => [...new Set((posts.value ?? []).map((post) => post.tag))].toSorted());
const activeTag = ref('all');

const filteredPosts = computed(() =>
  (posts.value ?? []).filter((post) => activeTag.value === 'all' || post.tag === activeTag.value),
);

useSeoMeta({
  title: () => t('marketing.pages.blog.title'),
  description: () => t('marketing.pages.blog.description'),
  ogTitle: () => t('marketing.pages.blog.title'),
  ogDescription: () => t('marketing.pages.blog.description'),
});
</script>
