import localeFeatures from '../locales/locale-features.json' with { type: 'json' };

/** Presentation metadata for a locale a consuming app ships translations for. */
export interface LocaleDefinition {
  /** Name of the language, written in that language, for the locale switcher. */
  readonly label: string;
  /** BCP 47 tag used for `<html lang>` and date formatting. */
  readonly language: string;
}

export const locales = {
  en: { label: 'English', language: 'en-US' },
  it: { label: 'Italiano', language: 'it-IT' },
} as const satisfies Record<string, LocaleDefinition>;

/** Locale codes the dashboard can render. */
export type LocaleCode = keyof typeof locales;

export const defaultLocale = 'en' satisfies LocaleCode;

/** Cookie `@nuxtjs/i18n` persists the visitor's locale choice in. */
export const localeCookieName = 'agent-zero-locale';

/**
 * Feature message files loaded (and deep-merged) per locale via `files`.
 * Layout: `locales/{locale}/{feature}.json`
 *
 * Translations are split by scope rather than kept in one file per locale, which is also the unit
 * Lunaria reports progress on.
 */
export const localeFeatureFiles = localeFeatures.features as readonly string[];

/** A feature file name (`common.json`, `marketing.json`, …) this package ships translations for. */
export type LocaleFeatureFile = (typeof localeFeatureFiles)[number];

function localeFilesFor(localeCode: string, features: readonly string[]): string[] {
  return features.map((feature) => `${localeCode}/${feature}`);
}

/**
 * `@nuxtjs/i18n` wants a flat array, while the app configuration keeps locales keyed by code so
 * the switcher and the head metadata can look one up directly.
 *
 * Apps pass the scopes they actually render: the dashboard and the marketing site share `common`
 * and `errors` but have no use for each other's copy, and every listed file is deep-merged into
 * the bundle whether or not a key from it is ever read.
 *
 * @throws If a requested feature file is not one this package ships, which would otherwise fail
 *   later as a missing-file error inside the module's locale loader.
 */
export function i18nLocalesFor(features: readonly LocaleFeatureFile[]) {
  const unknown = features.filter((feature) => !localeFeatureFiles.includes(feature));
  if (unknown.length > 0) throw new Error(`unknown locale feature file(s): ${unknown.join(', ')}`);

  return Object.entries(locales).map(([code, definition]) => ({
    code,
    language: definition.language,
    name: definition.label,
    files: localeFilesFor(code, features),
  }));
}

/** Every scope this package ships, for consumers that render all of them. */
export const i18nLocales = i18nLocalesFor(localeFeatureFiles);
