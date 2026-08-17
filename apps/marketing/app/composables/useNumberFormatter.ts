import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// Explicit imports rather than Nuxt's ambient auto-imports: oxlint's type-aware pass checks this
// plain .ts file against packages/i18n-style tsconfig resolution, which only sees `.nuxt/`'s
// generated auto-import types after `nuxt prepare` has run — CI's lint job never does.
export function useNumberFormatter(options?: Intl.NumberFormatOptions) {
  const { locale } = useI18n();

  return computed(() => new Intl.NumberFormat(locale.value, options));
}
