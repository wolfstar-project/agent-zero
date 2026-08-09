import type { Theme } from '@unocss/preset-wind4/theme';

export const theme = {
  font: {
    mono: "'Geist Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
    sans: "'Geist', Inter, ui-sans-serif, system-ui, sans-serif",
  },
  text: {
    '3xs': { fontSize: '0.625rem' },
    '4xs': { fontSize: '0.5625rem' },
  },
  colors: {
    canvas: 'var(--az-canvas)',
    panel: 'var(--az-panel)',
    raised: 'var(--az-raised)',
    line: 'var(--az-line)',
    ink: 'var(--az-ink)',
    muted: 'var(--az-muted)',
    accent: 'var(--az-accent)',
    warning: 'var(--az-warning)',
    danger: 'var(--az-danger)',
    link: 'var(--az-link)',
  },
} satisfies Theme;
