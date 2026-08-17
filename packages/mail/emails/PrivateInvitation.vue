<script setup>
import Base from './layouts/Base.vue';

const { name, inviterName, organizationName, acceptUrl } = useConfig();
</script>

<template>
  <Base>
    <Text class="m-0 mb-4 text-base/6 text-slate-700">
      <template v-if="name">Hi {{ name }}, </template>{{ inviterName }} invited you to
      <template v-if="organizationName">
        join <strong>{{ organizationName }}</strong> on Agent Zero.
      </template>
      <template v-else> create an account on Agent Zero. </template>
    </Text>

    <Button
      :href="acceptUrl"
      class="rounded bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
    >
      Accept invitation
    </Button>

    <Text class="m-0 mt-6 text-sm/6 text-slate-500">
      This link is tied to your email address and can be used once. If you were not expecting it,
      you can ignore this message.
    </Text>
  </Base>
</template>
