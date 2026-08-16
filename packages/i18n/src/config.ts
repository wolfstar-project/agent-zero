// Ported from wolfstar.rocks (Apache 2.0 license).
import type {
  DateTimeFormats,
  NumberFormats,
  PluralizationRule,
  PluralizationRules,
} from '@intlify/core-base';
import type { LocaleObject } from '@nuxtjs/i18n';

import localeFeatures from '../locales/locale-features.json' with { type: 'json' };

export interface LocaleObjectData extends LocaleObject {
  numberFormats?: NumberFormats;
  dateTimeFormats?: DateTimeFormats;
  pluralRule?: PluralizationRule;
}

/**
 * Feature message files loaded (and deep-merged) per locale via `files`.
 * Layout: `locales/{locale}/{feature}.json`
 *
 * Translations are split by scope rather than kept in one file per locale, which is also the unit
 * Lunaria reports progress on. Lazy-loading is always on in `@nuxtjs/i18n` v10 when using `files`.
 */
export const localeFeatureFiles = localeFeatures.features as readonly string[];

/** A feature file name (`common.json`, `marketing.json`, …) this package ships translations for. */
export type LocaleFeatureFile = (typeof localeFeatureFiles)[number];

function localeFilesFor(localeCode: string, features: readonly string[]): string[] {
  return features.map((feature) => `${localeCode}/${feature}`);
}

/**
 * Country / regional variants that inherit from a base language directory.
 * Each variant loads `locales/{base}/*.json` then `locales/{variant}/*.json`.
 *
 * Empty today: this repository ships one directory per selectable locale. Kept as the extension
 * point for the day `en` needs to split into `en-US` / `en-GB` without restructuring `locales/`.
 */
export const countryLocaleVariants: Record<string, (LocaleObjectData & { country?: boolean })[]> =
  {};

function createPluralRule(locale: string, mapping: Record<string, number>): PluralizationRule {
  return (choice: number, choicesLength: number) => {
    const name = new Intl.PluralRules(locale).select(choice);
    const plural = mapping[name] ?? 0;

    // In case a translation doesn't have all plural forms, use the last available form.
    if (plural > choicesLength - 1) return choicesLength - 1;

    return plural;
  };
}

/**
 * Base locales registered with Nuxt i18n.
 *
 * Codes that appear in `countryLocaleVariants` expand into regional variants and are not
 * themselves selectable.
 */
const baseLocales: LocaleObjectData[] = [
  {
    code: 'en',
    files: localeFilesFor('en', localeFeatureFiles),
    name: 'English',
    language: 'en-US',
  },
  {
    code: 'it',
    files: localeFilesFor('it', localeFeatureFiles),
    name: 'Italiano',
    language: 'it-IT',
  },
];

/** Locale codes this repository can render. */
export type LocaleCode = 'en' | 'it';

export const defaultLocale = 'en' satisfies LocaleCode;

/** Cookie `@nuxtjs/i18n` persists the visitor's locale choice in. */
export const localeCookieName = 'agent-zero-locale';

/** Expand base locales into country variants: `[...baseFiles, ...variantFiles]`. */
function buildLocales(): LocaleObjectData[] {
  const useLocales = baseLocales.reduce<LocaleObjectData[]>((acc, data) => {
    const localeVariants = countryLocaleVariants[data.code];
    if (localeVariants) {
      const baseFiles = localeFilesFor(data.code, localeFeatureFiles);
      for (const variant of localeVariants) {
        const entry: LocaleObjectData = {
          ...data,
          code: variant.code,
          name: variant.name,
          language: variant.code,
          files: [...baseFiles, ...localeFilesFor(variant.code, localeFeatureFiles)],
        };
        delete entry.file;
        acc.push(entry);
      }
    } else {
      acc.push(data);
    }
    return acc;
  }, []);

  return useLocales.toSorted((a, b) => a.code.localeCompare(b.code));
}

export const currentLocales = buildLocales();

export const datetimeFormats = Object.values(currentLocales).reduce<DateTimeFormats>(
  (acc, data) => {
    const dateTimeFormats = data.dateTimeFormats;
    if (dateTimeFormats) {
      acc[data.code] = { ...dateTimeFormats };
      delete data.dateTimeFormats;
    } else {
      acc[data.code] = {
        shortDate: { dateStyle: 'short' },
        short: { dateStyle: 'short', timeStyle: 'short' },
        long: { dateStyle: 'long', timeStyle: 'medium' },
      };
    }

    return acc;
  },
  {},
);

export const numberFormats = Object.values(currentLocales).reduce<NumberFormats>((acc, data) => {
  const localeNumberFormats = data.numberFormats;
  if (localeNumberFormats) {
    acc[data.code] = { ...localeNumberFormats };
    delete data.numberFormats;
  } else {
    acc[data.code] = {
      percentage: { style: 'percent', maximumFractionDigits: 1 },
      smallCounting: { style: 'decimal', maximumFractionDigits: 0 },
      kiloCounting: { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 },
      millionCounting: { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 },
    };
  }

  return acc;
}, {});

export const pluralRules = Object.values(currentLocales).reduce<PluralizationRules>((acc, data) => {
  const pluralRule = data.pluralRule;
  if (pluralRule) {
    acc[data.code] = pluralRule;
    delete data.pluralRule;
  }

  return acc;
}, {});

/** Presentation metadata for a locale a consuming app ships translations for. */
export interface LocaleDefinition {
  /** Name of the language, written in that language, for the locale switcher. */
  readonly label: string;
  /** BCP 47 tag used for `<html lang>` and date formatting. */
  readonly language: string;
}

/**
 * `currentLocales` keyed by code, for the switcher and head metadata, which look one up directly
 * rather than scanning the array.
 */
export const locales = Object.fromEntries(
  currentLocales.map((locale) => [
    locale.code,
    { label: locale.name ?? locale.code, language: locale.language ?? locale.code },
  ]),
) as Record<LocaleCode, LocaleDefinition>;

/**
 * `currentLocales` narrowed to the scopes an app actually renders.
 *
 * The dashboard and the marketing site share `common` and `errors` but have no use for each
 * other's copy, and every listed file is deep-merged into the bundle whether or not a key from it
 * is ever read.
 *
 * @throws If a requested feature file is not one this package ships, which would otherwise fail
 *   later as a missing-file error inside the module's locale loader.
 */
export function i18nLocalesFor(features: readonly LocaleFeatureFile[]): LocaleObjectData[] {
  const unknown = features.filter((feature) => !localeFeatureFiles.includes(feature));
  if (unknown.length > 0) throw new Error(`unknown locale feature file(s): ${unknown.join(', ')}`);

  return currentLocales.map((locale) => ({
    ...locale,
    files: localeFilesFor(locale.code, features),
  }));
}

export { createPluralRule };
