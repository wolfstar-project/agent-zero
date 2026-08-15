/**
 * Runtime vue-i18n options, auto-detected by `@nuxtjs/i18n` from this conventional path. The
 * `locales`/`defaultLocale`/`strategy` themselves stay in `nuxt.config.ts`'s `i18n` key — this file
 * is only for the composer options that module leaves to vue-i18n directly.
 */
export default defineI18nConfig(() => ({
  legacy: false,
  // `config/i18n-empty-placeholders.ts` strips untranslated keys from the bundle so vue-i18n falls
  // back to the default locale by design — that fallback is expected, routine behavior on this
  // site, not a bug to surface, so the warnings it would otherwise print are silenced.
  fallbackWarn: false,
  missingWarn: false,
}));
