<template>
  <section class="section-y">
    <div class="shell grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
      <div>
        <p class="m-0 eyebrow">{{ $t('marketing.hero.eyebrow') }}</p>
        <h1 class="m-0 mt-5 text-display font-750 tracking-tight">
          {{ $t('marketing.hero.title') }}
        </h1>
        <p class="m-0 mt-6 max-w-xl lede">{{ $t('marketing.hero.subtitle') }}</p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <NuxtLink class="btn btn-accent" :to="localePath('/pricing')">
            {{ $t('marketing.hero.primaryCta') }}
            <Icon aria-hidden="true" class="h-4 w-4 rtl:scale-x-[-1]" name="lucide:arrow-right" />
          </NuxtLink>
          <NuxtLink
            class="btn btn-subtle"
            :to="links.docs"
            external
            target="_blank"
            rel="noreferrer"
          >
            {{ $t('marketing.hero.secondaryCta') }}
          </NuxtLink>
        </div>

        <p class="m-0 mt-5 flex items-center gap-2 text-xs text-muted">
          <Icon aria-hidden="true" class="h-3.5 w-3.5 text-accent" name="lucide:shield-check" />
          {{ $t('marketing.hero.note') }}
        </p>
      </div>

      <figure class="m-0">
        <div class="panel overflow-hidden">
          <div class="h-9 flex items-center gap-2 border-b border-line px-3.5">
            <span class="h-2 w-2 rounded-full bg-danger/70" aria-hidden="true" />
            <span class="h-2 w-2 rounded-full bg-warning/70" aria-hidden="true" />
            <span class="h-2 w-2 rounded-full bg-accent/70" aria-hidden="true" />
            <span class="ms-2 mono text-muted">{{ $t('marketing.hero.terminalTitle') }}</span>
          </div>
          <!-- A transcript rather than a screenshot: it stays legible in both themes, needs no
               image request on the critical path, and is readable by a screen reader. -->
          <pre
            class="m-0 overflow-x-auto p-4 mono text-ink leading-relaxed"
          ><code>{{ transcript }}</code></pre>
        </div>
        <figcaption class="mt-3 text-xs text-muted">
          {{ $t('marketing.hero.terminalCaption') }}
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<script setup lang="ts">
const { links } = useAppConfig();
const localePath = useLocalePath();

// Static sample output, not a live run: the marketing site holds no credentials and never calls
// the runtime. Kept verbatim rather than translated because it is program output, not prose.
const transcript = `$ zero review --mode observe
→ mode        observe (read-only)
→ provider    anthropic/claude-opus-5
→ checkout    /srv/checkouts/acme-web@4f19c2a

✔ reproduced  src/user.ts:42  possible null dereference
✔ verified    pnpm test -- user.spec.ts  (14 passed)

2 findings · 0 writes · run 3a91f0`;
</script>
