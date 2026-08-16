<template>
  <!-- Three routes out, no form. This app owns no persistence and no mail transport, so a
       form here could only pretend to deliver something. -->
  <ul class="m-0 mt-10 grid list-none gap-4 ps-0 sm:grid-cols-2">
    <li v-for="channel in channels" :key="channel.id" class="card">
      <span
        class="h-9 w-9 grid place-items-center border border-accent/45 bg-accent/8 text-accent"
        aria-hidden="true"
      >
        <Icon class="h-4.5 w-4.5" :name="channel.icon" />
      </span>
      <h2 class="m-0 mt-4 text-base font-700">
        <NuxtLink
          class="focus-ring transition hover:text-accent"
          :to="channel.href"
          external
          :target="channel.href.startsWith('mailto:') ? undefined : '_blank'"
          :rel="channel.href.startsWith('mailto:') ? undefined : 'noreferrer'"
        >
          {{ $t(channel.titleKey) }}
        </NuxtLink>
      </h2>
      <p class="m-0 mt-2 text-sm text-muted leading-relaxed">{{ $t(channel.bodyKey) }}</p>
    </li>
  </ul>
</template>

<script setup lang="ts">
const channels = [
  {
    id: 'issues',
    icon: 'lucide:circle-dot',
    href: links.issues,
    titleKey: 'marketing.pages.contact.issuesTitle',
    bodyKey: 'marketing.pages.contact.issuesBody',
  },
  {
    id: 'email',
    icon: 'lucide:mail',
    href: `mailto:${links.contactEmail}`,
    titleKey: 'marketing.pages.contact.emailTitle',
    bodyKey: 'marketing.pages.contact.emailBody',
  },
  {
    id: 'security',
    icon: 'lucide:shield-alert',
    href: links.security,
    titleKey: 'marketing.pages.contact.securityTitle',
    bodyKey: 'marketing.pages.contact.securityBody',
  },
] as const;
</script>
