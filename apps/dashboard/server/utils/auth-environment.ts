export function dashboardUrlFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const configuredUrl = environment.NUXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl;
  return environment.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined;
}
