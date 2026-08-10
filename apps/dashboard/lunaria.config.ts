import type { Locale } from '@lunariajs/core';
import { defineConfig } from '@lunariajs/core/config';

import { defaultLocale, locales } from './config/i18n.js';

// Derived from `config/i18n.ts` so the translation status can never drift from the locales the
// dashboard actually ships. Lunaria wants a source locale plus a non-empty list of targets.
const sourceLocale: Locale = { label: locales[defaultLocale].label, lang: defaultLocale };

const targetLocales = Object.entries(locales)
  .filter(([lang]) => lang !== defaultLocale)
  .map(([lang, definition]): Locale => ({ label: definition.label, lang }));

if (targetLocales.length === 0) {
  throw new Error('No locales found besides source locale');
}

export default defineConfig({
  repository: {
    name: 'wolfstar-project/agent-zero',
    rootDir: 'apps/dashboard',
  },
  sourceLocale,
  locales: targetLocales as [Locale, ...Locale[]],
  files: [
    {
      include: ['i18n/locales/en/**/*.json'],
      pattern: 'i18n/locales/@lang/@path',
      type: 'dictionary',
    },
  ],
});
