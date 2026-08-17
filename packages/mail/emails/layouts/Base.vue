<template>
  <!-- `<meta name="color-scheme">` and `supported-color-schemes` are already emitted by Layout.
       The two canvas colours below are the only hexes left in the templates: they sit on Layout's
       own `<body>`/article elements, outside the `Tailwind` block whose theme defines the tokens,
       so they compile against Tailwind's stock theme where `canvas` does not exist. -->
  <Layout body-class="bg-[#F8FBF8] dark:bg-[#070D09]" class="bg-[#F8FBF8] dark:bg-[#070D09]">
    <!-- The `#config` slot is read at setup time and never rendered: Maizzle compiles it as the CSS
         entry for every class inside this block, then appends the result as one `<style>` to
         `<head>`. This is the email counterpart of the marketing site's Uno theme — one place that
         names the brand palette, type steps, and font stacks, so no template writes a raw value. -->
    <Tailwind>
      <template #config>
      @import "@maizzle/tailwindcss" source(none); @theme { --color-canvas: #f8fbf8;
      --color-canvas-dark: #070d09; --color-panel: #f1f5f1; --color-panel-dark: #0d1310;
      --color-line: #bfc7bf; --color-line-dark: #28302b; --color-ink: #0b140e; --color-ink-dark:
      #eff3ee; --color-muted: #48574d; --color-muted-dark: #95a29b; --color-accent: #1c6a00;
      --color-accent-dark: #84e04f; --color-tint: #e6efe4; --color-tint-dark: #111e0f;
      --color-on-accent: #fffffe; --color-on-accent-dark: #070d09; --font-body: Inter,
      -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --font-code: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; --text-eyebrow:
      10px; --text-eyebrow--line-height: 1; --text-fine: 12px; --text-fine--line-height: 20px;
      --text-body: 15px; --text-body--line-height: 24px; --text-callout: 13px;
      --text-callout--line-height: 21px; --text-value: 15px; --text-value--line-height: 22px;
      --text-title: 20px; --text-title--line-height: 28px; --text-wordmark: 13px;
      --text-wordmark--line-height: 1; --text-monogram: 11px; --text-monogram--line-height: 1;
      --tracking-eyebrow: 0.16em; --tracking-title: -0.01em; --tracking-wordmark: 0.18em;
      --tracking-monogram: 0.06em; --tracking-label: 0.01em; }
    </template>

    <!-- `<meta name="color-scheme">` and `supported-color-schemes` are already emitted by Layout. -->
    <Layout body-class="bg-canvas dark:bg-canvas-dark" class="bg-canvas dark:bg-canvas-dark">
      <!-- The font stack sits here rather than on Layout: Layout's own `font-inter` would otherwise
           be emitted after it and win. Everything inside inherits. -->
      <Container class="p-6 font-body">
        <div class="border border-line border-solid bg-panel p-8 dark:border-line-dark dark:bg-panel-dark">
          <Header />

          <div class="pt-8">
            <slot />
          </div>

          <div class="pt-8">
            <Divider />
          </div>

          <div class="pt-5">
            <Footer>
              <slot name="footer" />
            </Footer>
          </div>
        </div>
      </Container>
    </Layout>
  </Tailwind>
</template>

<script setup lang="ts">
import Divider from '../components/Divider.vue';
import Footer from '../components/Footer.vue';
import Header from '../components/Header.vue';

/**
 * Shell every message renders into: canvas wrapper, square hairline-bordered panel, brand lockup,
 * body, rule, footer. Light-first — every colour is a theme token that Maizzle inlines as an
 * explicit hex, with a `dark:` counterpart that compiles into the head `<style>` as a
 * `prefers-color-scheme` rule (media queries cannot be inlined, so those classes survive by design).
 * Tokens rather than CSS custom properties in the markup: Outlook's Word engine drops `var()`.
 *
 * Components under `emails/components/` are imported by relative path: that directory is not one
 * Maizzle auto-registers, and `components.source` is not read at send time.
 *
 * API: `preheader` — the inbox preview line. Default slot is the message body; the `footer` slot
 * appends a note below the standard footer copy.
 */
const { preheader = 'A message from Agent Zero.' } = defineProps<{ preheader?: string }>();

usePlaintext();
usePreheader(preheader);
</script>
