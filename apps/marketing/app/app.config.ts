/**
 * Nuxt's own `defineAppConfig` is a plain identity function, but importing it from `nuxt/app`
 * pulls in that package's module graph — which reaches for `#build/nuxt.config.mjs`, a virtual
 * module that only exists inside a running Nuxt build. This file is also evaluated directly by the
 * plain-Node `unit` Vitest project (`test/unit/*` imports the named exports below without booting
 * Nuxt), so a local, behaviourally identical stand-in avoids that import entirely.
 */
function defineAppConfig<T>(config: T): T {
  return config;
}

/**
 * Public, non-secret site metadata, resolved through Nuxt's own `useAppConfig()` rather than a
 * hand-rolled `config/app.ts` module: `apps/dashboard` already uses `appConfig` for its own
 * capability flags, so this follows the same idiom instead of inventing a second one. Everything
 * here is static and ships in the client bundle — nothing that needs an environment override
 * belongs in this file (see `nuxt.config.ts` for the two site URLs, which do).
 *
 * The values are named exports, not just fields on the default export, for that same reason.
 */
export const site = {
  name: 'Agent Zero',
} as const;

/** Off-site destinations rendered in the header, footer, and calls to action. */
export const links = {
  repository: 'https://github.com/RedStarDev/agent-zero',
  issues: 'https://github.com/RedStarDev/agent-zero/issues',
  security: 'https://github.com/RedStarDev/agent-zero/blob/main/SECURITY.md',
  changelog: 'https://github.com/RedStarDev/agent-zero/releases',
  architecture: 'https://github.com/RedStarDev/agent-zero/blob/main/docs/architecture.md',
  docs: 'https://github.com/RedStarDev/agent-zero#readme',
  contactEmail: 'hello@agent-zero.dev',
} as const;

export default defineAppConfig({ site, links });
