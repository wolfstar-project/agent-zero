<script setup>
import Base from './layouts/Base.vue';

const { organizationName, inviterName, acceptUrl } = useConfig();
</script>

<template>
  <Base>
    <Text class="m-0 mb-4 text-base/6 text-slate-700">
      {{ inviterName }} invited you to join <strong>{{ organizationName }}</strong> on Agent Zero.
    </Text>

    <Button
      :href="acceptUrl"
      class="rounded bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
    >
      Accept invitation
    </Button>

    <Text class="m-0 mt-6 text-sm/6 text-slate-500"> This invitation expires in 48 hours. </Text>
  </Base>
</template>
