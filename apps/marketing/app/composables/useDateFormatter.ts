export function useDateFormatter(options?: Intl.DateTimeFormatOptions) {
  const { locale } = useI18n();

  return computed(() => new Intl.DateTimeFormat(locale.value, options));
}
