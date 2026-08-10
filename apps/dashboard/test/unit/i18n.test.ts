import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { defaultLocale, locales } from '../../config/i18n.js';
import lunariaConfig from '../../lunaria.config.json' with { type: 'json' };

const localesDirectory = join(import.meta.dirname, '../../i18n/locales');
const sourceLocale: string = defaultLocale;

const localeEntries = Object.entries(locales).map(([lang, definition]) => ({
  lang,
  label: definition.label,
}));
const sourceEntry = localeEntries.find((entry) => entry.lang === sourceLocale);
const targetLocales = localeEntries.filter((entry) => entry.lang !== sourceLocale);

const sourceFiles = readdirSync(join(localesDirectory, sourceLocale)).filter((file) =>
  file.endsWith('.json'),
);

function readDictionary(locale: string, file: string): unknown {
  const parsed: unknown = JSON.parse(readFileSync(join(localesDirectory, locale, file), 'utf8'));
  return parsed;
}

/** Flatten to dotted key paths so a missing leaf is reported precisely. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    keyPaths(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translation dictionaries', () => {
  it('ships at least one scope for the source locale', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  describe.each(targetLocales.map((entry) => entry.lang))('%s', (locale) => {
    it.each(sourceFiles)('matches the %s key set', (file) => {
      const source = new Set(keyPaths(readDictionary(sourceLocale, file)));
      const target = new Set(keyPaths(readDictionary(locale, file)));

      expect(target).toEqual(source);
    });
  });
});

describe('lunaria configuration', () => {
  // Lunaria only reads JSON, so its locale list is a copy of the dashboard configuration rather
  // than an import of it. This keeps the copy honest.
  it('tracks the same source locale as the dashboard', () => {
    expect(lunariaConfig.defaultLocale).toEqual(sourceEntry);
  });

  it('tracks every non-source locale the dashboard ships', () => {
    expect(lunariaConfig.locales).toEqual(targetLocales);
  });
});
