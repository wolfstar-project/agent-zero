export function useNumberFormatter(options?: Intl.NumberFormatOptions) {
  const { locale } = useI18n();

  return computed(() => new Intl.NumberFormat(locale.value, options));
}
