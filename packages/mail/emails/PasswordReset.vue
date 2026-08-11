<script setup>
import Base from './layouts/Base.vue';

const { name, resetUrl } = useConfig();
</script>

<template>
  <Base>
    <Text class="m-0 mb-4 text-base/6 text-slate-700">Hello {{ name }},</Text>

    <Text class="m-0 mb-6 text-base/6 text-slate-700">
      Use the link below to choose a new password. If you did not request a reset, your password
      remains unchanged.
    </Text>

    <Button
      :href="resetUrl"
      class="rounded bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
    >
      Reset password
    </Button>
  </Base>
</template>
