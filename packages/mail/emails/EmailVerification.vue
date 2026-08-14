<script setup>
import Base from './layouts/Base.vue';

const { name, verifyUrl } = useConfig();
</script>

<template>
  <Base>
    <Text class="m-0 mb-4 text-base/6 text-slate-700">Hello {{ name }},</Text>

    <Text class="m-0 mb-6 text-base/6 text-slate-700">
      Confirm this address to finish setting up your Agent Zero account.
    </Text>

    <Button
      :href="verifyUrl"
      class="rounded bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
    >
      Confirm email address
    </Button>
  </Base>
</template>
