<script setup>
import ActionButton from './components/ActionButton.vue';
import Callout from './components/Callout.vue';
import Base from './layouts/Base.vue';

const { organizationName, inviterName, acceptUrl } = useConfig();
</script>

<template>
  <Base preheader="You have been invited to join an organization on Agent Zero.">
    <Text
      class="m-0 text-[10px] font-bold tracking-[0.16em] text-[#48574D] uppercase dark:text-[#95A29B]"
    >
      Invitation
    </Text>

    <Heading
      level="1"
      class="mt-3 text-[20px] leading-[28px] font-bold tracking-[-0.01em] text-[#0B140E] dark:text-[#EFF3EE]"
    >
      You have been invited to an organization
    </Heading>

    <Text class="mt-5 text-[15px] leading-[24px] text-[#0B140E] dark:text-[#EFF3EE]">
      {{ inviterName }} invited you to join <strong>{{ organizationName }}</strong> on Agent Zero.
    </Text>

    <div class="pt-6">
      <Callout>
        <Text
          class="m-0 text-[10px] font-bold tracking-[0.16em] text-[#48574D] uppercase dark:text-[#95A29B]"
        >
          Organization
        </Text>
        <Text
          class="mt-2 [font-family:SFMono-Regular,Consolas,'Liberation_Mono',Menlo,monospace] text-[15px] leading-[22px] font-bold break-words text-[#0B140E] dark:text-[#EFF3EE]"
        >
          {{ organizationName }}
        </Text>
      </Callout>
    </div>

    <div class="pt-7">
      <ActionButton :href="acceptUrl">Accept invitation</ActionButton>
    </div>

    <Text class="mt-7 text-[12px] leading-[20px] text-[#48574D] dark:text-[#95A29B]">
      If the button does not work, paste this address into your browser:
    </Text>

    <Text
      class="mt-2 font-[SFMono-Regular,Consolas,'Liberation_Mono',Menlo,monospace] text-[12px] leading-[20px] break-all text-[#48574D] dark:text-[#95A29B]"
    >
      {{ acceptUrl }}
    </Text>

    <template #footer>
      <Text class="mt-2 text-[12px] leading-[20px] text-[#48574D] dark:text-[#95A29B]">
        This invitation expires in 48 hours.
      </Text>
    </template>
  </Base>
</template>
