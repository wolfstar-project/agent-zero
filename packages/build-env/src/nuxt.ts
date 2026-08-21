import { addImports, addTemplate, defineNuxtModule } from '@nuxt/kit';

import { resolveBuildInfo } from './resolve.js';
import type { BuildInfo } from './types.js';

export interface BuildEnvModuleOptions {
  /** The branch a non-pull-request deploy has to be on to be the canary. Defaults to `main`. */
  defaultBranch?: string;
  /**
   * Whether `useBuildInfo()` completes unresolved fields from the server's own environment.
   *
   * On by default, and the reason this module exists rather than a few lines in `nuxt.config.ts`:
   * a Vercel build resolves everything while it runs, and every other deployment — a container
   * image built in CI, a self-hosted `node .output/server/index.mjs` — has nothing to resolve
   * from until it is started. Turn it off only for a bundle that must publish exactly what it was
   * built with.
   */
  runtimeFallback?: boolean;
}

/**
 * Deterministic metadata for test and prerender-snapshot runs.
 *
 * Tests must not depend on the checkout they run in: reading the real branch and commit would make
 * every assertion that renders build metadata fail on someone else's machine, and every snapshot
 * churn on each commit.
 */
const testBuildInfo: BuildInfo = {
  version: '0.0.0',
  commit: '0000000000000000000000000000000000000000',
  shortCommit: '0000000',
  branch: 'test',
  env: 'dev',
  time: 0,
  prNumber: null,
  previewUrl: null,
  productionUrl: null,
};

/**
 * Publishes what this build is, under `runtimeConfig.public.buildInfo`.
 *
 * `runtimeConfig.public` rather than `appConfig`, which is the opposite of the choice the dashboard
 * makes for its auth policy — and for the opposite reason. Auth policy must not be overridable at
 * run time, because a public runtime key would let a deployment advertise a sign-in method its
 * server rejects. Build metadata is the one thing a non-Vercel build *cannot* discover about
 * itself, so it has to stay overridable: the same `NUXT_PUBLIC_BUILD_INFO_*` channel that would be
 * a hazard for policy is the delivery mechanism here, alongside the server-side pass below.
 */
export default defineNuxtModule<BuildEnvModuleOptions>({
  meta: {
    name: 'agent-zero:build-env',
    configKey: 'buildEnv',
  },
  defaults: {
    runtimeFallback: true,
  },
  async setup(options, nuxt) {
    const buildInfo =
      nuxt.options.test || process.env.NODE_ENV === 'test'
        ? testBuildInfo
        : await resolveBuildInfo({
            rootDirectory: nuxt.options.rootDir,
            isDevelopment: nuxt.options.dev,
            ...(options.defaultBranch === undefined
              ? {}
              : { defaultBranch: options.defaultBranch }),
          });

    // Every key is declared, including the ones that resolved to a sentinel: Nuxt only applies a
    // `NUXT_PUBLIC_*` override to a key the build declared, so an omitted field could not be
    // supplied by the deployment that needs to supply it.
    nuxt.options.runtimeConfig.public.buildInfo = buildInfo;

    // The composable, not a Nitro plugin: Nitro deep-freezes its runtime config before the first
    // request, so nothing may write the completed metadata back into it. Resolving inside
    // `useState` instead keeps the answer server-side, serialises it into the SSR payload, and
    // leaves the client hydrating the same values the server rendered.
    const composable = addTemplate({
      filename: 'agent-zero-build-env.mjs',
      write: true,
      getContents: () => buildInfoComposable(options),
    });
    addImports({ name: 'useBuildInfo', as: 'useBuildInfo', from: composable.dst });
  },
});

/**
 * `useBuildInfo()`: what this build is, completed from the running server's environment.
 *
 * Generated rather than shipped as a file in this package so the app's own build compiles it, and
 * so `import.meta.server` is the constant the bundler eliminates the run-time branch by — the
 * client bundle never carries the fallback, or the `process.env` read behind it.
 */
function buildInfoComposable(options: BuildEnvModuleOptions): string {
  const resolveOptions =
    options.defaultBranch === undefined
      ? '{}'
      : JSON.stringify({ defaultBranch: options.defaultBranch });
  // Both branches go through `runtimeBuildInfo`, and the client's is handed an empty environment
  // rather than skipped: Nuxt rewrites the `null` fields of `runtimeConfig` to empty strings, and
  // that pass is also what normalises them back, so a client-only render reports the same shape a
  // server-rendered one does.
  const resolve = options.runtimeFallback
    ? `import.meta.server ? runtimeBuildInfo(buildInfo, process.env, ${resolveOptions}) : runtimeBuildInfo(buildInfo, {}, ${resolveOptions})`
    : `runtimeBuildInfo(buildInfo, {}, ${resolveOptions})`;

  return `${options.runtimeFallback ? "import process from 'node:process';\n\n" : ''}import { runtimeBuildInfo } from '@agent-zero/build-env';
import { useRuntimeConfig, useState } from '#imports';

export function useBuildInfo() {
  // Keyed state rather than a plain call: the value is resolved once on the server and travels to
  // the browser in the payload, so a component that renders it cannot hydrate to a different one.
  return useState('agent-zero:build-info', () => {
    const buildInfo = useRuntimeConfig().public.buildInfo;
    return ${resolve};
  }).value;
}
`;
}

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    buildInfo: BuildInfo;
  }
}

export type { BuildInfo, EnvType } from './types.js';
