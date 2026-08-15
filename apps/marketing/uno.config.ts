import process from 'node:process';

import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss';

import { presetA11y } from './uno-preset-a11y.js';
import { presetRtl } from './uno-preset-rtl.js';
import { theme } from './uno.theme.js';

export default defineConfig({
  content: {
    pipeline: {
      exclude: [/\.(css|postcss|sass|scss|less|stylus|styl)($|\?)/, /\?macro=true/],
      include: [/\.(vue|html)($|\?)/],
    },
  },
  presets: [
    presetWind4(),
    // Dev-time checkers that warn on physical direction and hardcoded pixel text sizes.
    // Keep these presets last.
    ...(process.env.CI ? [] : [presetRtl(), presetA11y()]),
  ],
  transformers: [transformerDirectives({ enforce: 'pre' }), transformerVariantGroup()],
  theme,
  shortcuts: [
    // Layout. The marketing site is read at arm's length rather than scanned, so its rhythm is
    // wider and softer than the dashboard's dense operational panels.
    ['shell', 'mx-auto w-full max-w-6xl px-5 sm:px-8'],
    ['section-y', 'py-16 sm:py-24'],
    ['panel', 'border border-line bg-panel'],
    ['card', 'panel p-6 transition hover:border-muted'],

    // Typography
    ['mono', 'font-mono text-xs'],
    ['eyebrow', 'text-3xs text-accent font-700 tracking-[0.18em] uppercase'],
    ['lede', 'text-base text-muted leading-relaxed sm:text-lg'],

    // Focus states - subtle but accessible
    [
      'focus-ring',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    ],

    // Controls
    [
      'btn',
      'focus-ring h-11 inline-flex items-center justify-center gap-2 border px-5 text-sm text-ink font-650 transition disabled:cursor-not-allowed disabled:opacity-60',
    ],
    ['btn-subtle', 'btn border-line bg-raised hover:border-muted'],
    ['btn-accent', 'btn border-accent/45 bg-accent/8 hover:border-accent'],
    ['btn-sm', 'h-9 px-3.5 text-xs'],
    [
      'btn-icon',
      'focus-ring h-9 w-9 grid place-items-center border border-line bg-raised text-ink transition hover:border-muted',
    ],
    ['btn-link', 'focus-ring text-sm text-link'],
    ['input-field', 'focus-ring h-9 border border-line bg-raised px-2.5 text-xs text-ink'],
  ],
});
