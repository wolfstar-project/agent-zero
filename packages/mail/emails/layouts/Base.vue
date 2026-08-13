<script setup>
usePlaintext();
</script>

<template>
  <Layout>
    <Container class="mx-auto max-w-[600px] p-6">
      <Text class="m-0 mb-6 text-sm text-slate-500">Agent Zero</Text>

      <slot />

      <Text class="m-0 mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
        If you were not expecting this message you can safely ignore it.
      </Text>
    </Container>
  </Layout>
</template>
