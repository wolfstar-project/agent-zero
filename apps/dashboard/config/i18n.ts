import localeFeatures from '../i18n/locale-features.json' with { type: 'json' };

/** Presentation metadata for a locale the dashboard ships translations for. */
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
 * Layout: `i18n/locales/{locale}/{feature}.json`
 *
 * Translations are split by scope rather than kept in one file per locale, which is also the unit
 * Lunaria reports progress on.
 */
const localeFeatureFiles = localeFeatures.features as readonly string[];

function localeFilesFor(localeCode: string): string[] {
  return localeFeatureFiles.map((feature) => `${localeCode}/${feature}`);
}

/**
 * `@nuxtjs/i18n` wants a flat array, while the dashboard configuration keeps locales keyed by code
 * so the switcher and the head metadata can look one up directly.
 */
export const i18nLocales = Object.entries(locales).map(([code, definition]) => ({
  code,
  language: definition.language,
  name: definition.label,
  files: localeFilesFor(code),
}));
