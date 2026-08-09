import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss';

import { theme } from './uno.theme.js';

export default defineConfig({
  content: {
    pipeline: {
      exclude: [/\.(css|postcss|sass|scss|less|stylus|styl)($|\?)/, /\?macro=true/],
      include: [/\.(vue|html)($|\?)/],
    },
  },
  presets: [presetWind4()],
  transformers: [transformerDirectives({ enforce: 'pre' }), transformerVariantGroup()],
  theme,
  shortcuts: [
    ['az-panel', 'border border-line bg-panel'],
    [
      'az-section-title',
      'h-11 flex items-center justify-between border-b border-line px-3.5 font-650',
    ],
    ['az-mono', 'font-mono text-xs'],
    [
      'az-focus',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    ],
  ],
});
