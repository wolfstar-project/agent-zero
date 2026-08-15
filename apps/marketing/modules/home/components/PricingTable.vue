<template>
  <section id="pricing" class="section-y scroll-mt-20">
    <div class="shell">
      <div class="max-w-2xl">
        <h2 class="m-0 text-headline font-750 tracking-tight">
          {{ $t('marketing.pricing.title') }}
        </h2>
        <p class="m-0 mt-4 lede">{{ $t('marketing.pricing.subtitle') }}</p>
      </div>

      <!-- A radiogroup rather than two buttons: the choice is exclusive, and arrow keys should
           move between the options the way they do in any other set of radios. -->
      <div
        class="mt-8 inline-flex items-center border border-line bg-raised p-1"
        role="radiogroup"
        :aria-label="$t('marketing.pricing.intervalLabel')"
      >
        <button
          v-for="option in intervals"
          :key="option"
          class="focus-ring h-9 px-4 text-xs font-650 transition"
          :class="interval === option ? 'bg-accent/12 text-ink' : 'text-muted hover:text-ink'"
          type="button"
          role="radio"
          :aria-checked="interval === option"
          @click="interval = option"
        >
          {{ $t(`marketing.pricing.${option}`) }}
        </button>
      </div>
      <p v-show="interval === 'yearly'" class="m-0 mt-2.5 text-xs text-accent font-650">
        {{ $t('marketing.pricing.yearlyHint') }}
      </p>

      <ul class="m-0 mt-10 grid list-none items-start gap-4 ps-0 lg:grid-cols-3">
        <li
          v-for="plan in pricingPlans"
          :key="plan.id"
          class="panel flex flex-col p-6"
          :class="plan.recommended ? 'border-accent/45 bg-accent/4' : ''"
        >
          <div class="flex items-center justify-between gap-3">
            <h3 class="m-0 text-base font-700">
              {{ $t(`marketing.pricing.plans.${plan.id}.name`) }}
            </h3>
            <span
              v-if="plan.recommended"
              class="border border-accent/45 bg-accent/8 px-2 py-0.5 text-3xs text-accent font-700 tracking-wider uppercase"
            >
              {{ $t('marketing.pricing.recommended') }}
            </span>
          </div>

          <p class="m-0 mt-2 min-h-10 text-sm text-muted leading-relaxed">
            {{ $t(`marketing.pricing.plans.${plan.id}.description`) }}
          </p>

          <p class="m-0 mt-6 flex items-baseline gap-1.5">
            <span class="text-3xl font-750 tracking-tight">{{ priceLabel(plan) }}</span>
            <span v-if="plan.price" class="text-xs text-muted font-600">
              {{ $t(`marketing.pricing.per${interval === 'monthly' ? 'Month' : 'Year'}`) }}
            </span>
          </p>

          <ul class="m-0 mt-6 flex flex-1 list-none flex-col gap-2.5 ps-0">
            <li
              v-for="feature in plan.features"
              :key="feature"
              class="flex items-start gap-2 text-sm text-muted"
            >
              <Icon
                aria-hidden="true"
                class="mt-0.5 h-4 w-4 shrink-0 text-accent"
                name="lucide:check"
              />
              {{ $t(`marketing.pricing.plans.${plan.id}.features.${feature}`) }}
            </li>
          </ul>

          <NuxtLink
            class="mt-8 w-full"
            :class="plan.recommended ? 'btn btn-accent' : 'btn btn-subtle'"
            :to="ctaHref(plan)"
            :external="isExternalCta(plan)"
            :target="isExternalCta(plan) ? '_blank' : undefined"
            :rel="isExternalCta(plan) ? 'noreferrer' : undefined"
          >
            {{ $t(`marketing.pricing.plans.${plan.id}.cta`) }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { pricingPlans } from '~~/config/content.js';
import type { BillingInterval, PricingPlan } from '~~/config/content.js';

const { links } = useAppConfig();
const { t } = useI18n();
const localePath = useLocalePath();
const interval = useBillingInterval();
const formatPrice = usePriceFormatter();
const dashboardUrl = useRuntimeConfig().public.dashboardUrl;

const intervals: readonly BillingInterval[] = ['monthly', 'yearly'];

/** Tiers without a list price show "Custom" where the amount would be. */
function priceLabel(plan: PricingPlan): string {
  if (!plan.price) return t('marketing.pricing.custom');
  return formatPrice.value(plan.price[interval.value]);
}

function isExternalCta(plan: PricingPlan): boolean {
  return plan.ctaTarget !== 'contact';
}

function ctaHref(plan: PricingPlan): string {
  if (plan.ctaTarget === 'repository') return links.repository;
  if (plan.ctaTarget === 'dashboard') return dashboardUrl;
  return localePath('/contact');
}
</script>
