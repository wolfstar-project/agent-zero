<template>
  <div class="section-y">
    <div class="shell">
      <div class="max-w-2xl">
        <h1 class="m-0 text-headline font-750 tracking-tight">
          {{ $t("marketing.pages.changelog.heading") }}
        </h1>
        <p class="m-0 mt-4 lede">{{ $t("marketing.pages.changelog.subtitle") }}</p>
      </div>

      <p v-if="entries && entries.length === 0" class="m-0 mt-10 text-sm text-muted">
        {{ $t("marketing.pages.changelog.empty") }}
      </p>
      <ul v-else class="m-0 mt-10 grid list-none gap-4 ps-0">
        <ChangelogEntry v-for="entry in entries" :key="entry.path" :entry="entry" />
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

const { data: entries } = await useAsyncData("changelog-index", () =>
  queryCollection("changelog").order("date", "DESC").all(),
);

useSeoMeta({
  title: () => t("marketing.pages.changelog.title"),
  description: () => t("marketing.pages.changelog.description"),
  ogTitle: () => t("marketing.pages.changelog.title"),
  ogDescription: () => t("marketing.pages.changelog.description"),
});
</script>
