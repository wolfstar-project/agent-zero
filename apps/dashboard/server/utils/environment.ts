/**
 * Every environment variable this app's server reads, resolved in one module.
 *
 * Each resolver takes the environment record rather than reaching for `process.env` itself, so
 * routes stay testable without mutating the real process environment, and so the read stays lazy:
 * a deployment can set these at run time, unlike Nuxt's `runtimeConfig`, whose defaults are baked
 * at build time and would require renaming every variable to its `NUXT_`-prefixed form.
 */
export function dashboardUrlFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const configuredUrl = environment.NUXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl;
  return environment.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined;
}

/** Without this secret the webhook route ingests nothing; signature verification cannot run. */
export function githubWebhookSecretFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  return environment.GITHUB_WEBHOOK_SECRET || undefined;
}

/** The checkout every ingested delivery runs against, behind the runner boundary. */
export function checkoutPathFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  return environment.AGENT_ZERO_CHECKOUT_PATH?.trim() || undefined;
}
