<script setup>
/**
 * Square call-to-action wrapping Maizzle's bulletproof `<Button>`, which emits the Outlook `<i>`
 * spacers — the padding and `mso-*` defaults are left untouched so those stay calibrated.
 *
 * API: `href` (required), `variant` — `'solid'` (default) or `'outline'`. Default slot is the label.
 *
 * Named `ActionButton` rather than `Button`: a component file called `Button.vue` resolves the
 * `<Button>` tag in its own template to itself (Vue's filename-inferred self-reference), which
 * recurses until the stack overflows.
 *
 * Light and dark carry different foregrounds on purpose. The dark accent is a bright lime, so
 * light text on it measures 1.65:1 while dark canvas text on it measures 11.92:1.
 */
defineProps({
  href: { type: String, required: true },
  variant: { type: String, default: 'solid' },
});

const SOLID =
  'border border-[#1C6A00] border-solid bg-[#1C6A00] text-[#FFFFFE] dark:border-[#84E04F] dark:bg-[#84E04F] dark:text-[#070D09]';

const OUTLINE =
  'border border-[#1C6A00] border-solid bg-transparent text-[#1C6A00] dark:border-[#84E04F] dark:text-[#84E04F]';
</script>

<template>
  <Button
    :href="href"
    :variant="variant === 'outline' ? 'outline' : 'solid'"
    class="rounded-none [font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif] font-semibold tracking-[0.01em]"
    :class="variant === 'outline' ? OUTLINE : SOLID"
  >
    <slot />
  </Button>
</template>
