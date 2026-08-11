import type { AuthActionError } from '@onmax/nuxt-better-auth';
// Imported explicitly rather than relying on Nuxt auto-imports: the package's plain `tsc` pass
// checks `app/**/*.ts` without the generated auto-import declarations that `vue-tsc` sees.
import { useI18n } from 'vue-i18n';

/**
 * Resolve a Better Auth error into a localized string.
 *
 * Prefers `auth.errors.<CODE>` when a translation exists. An unrecognised code falls back to the
 * generic message rather than to the raw server text: error strings from the auth adapter are
 * untrusted input and must not be rendered verbatim.
 */
export function useAuthErrorMessage() {
  // Kept as one object rather than destructured: `t` and `te` are bound methods of the composer.
  const i18n = useI18n();

  function localizeAuthError(
    error: AuthActionError | null | undefined,
    fallbackKey = 'auth.errors.GENERIC',
  ): string {
    if (!error) return i18n.t(fallbackKey);

    const code = error.code?.trim();
    if (code) {
      const codeKey = `auth.errors.${code}`;
      if (i18n.te(codeKey)) return i18n.t(codeKey);

      const upperKey = `auth.errors.${code.toUpperCase()}`;
      if (i18n.te(upperKey)) return i18n.t(upperKey);
    }

    // A request that never reached the adapter has no code attached.
    if (error.status === undefined) return i18n.t('auth.errors.UNREACHABLE');

    return i18n.t(fallbackKey);
  }

  return { localizeAuthError };
}
