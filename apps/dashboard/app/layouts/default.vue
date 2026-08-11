<template>
  <div class="min-h-screen bg-canvas text-ink">
    <AppSidebar />
    <main class="min-h-screen transition-[margin]" :class="collapsed ? 'md:ms-16' : 'md:ms-52'">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const collapsed = useSidebarCollapsed();
</script>
