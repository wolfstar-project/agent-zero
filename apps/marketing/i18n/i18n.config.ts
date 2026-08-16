import { defaultLocale, locales } from '@agent-zero/i18n';

export default defineI18nConfig(() => {
  return {
    availableLocales: Object.keys(locales),
    fallbackLocale: defaultLocale,
    // Untranslated keys ship as empty strings and are stripped from the bundle by the
    // `i18n-strip-empty` local module, so falling back to the default locale is routine,
    // expected behavior on this site — not something to warn about on every render.
    fallbackWarn: false,
    missingWarn: false,
  };
});
