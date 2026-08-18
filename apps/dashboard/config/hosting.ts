import { dirname, join } from 'node:path';

/**
 * Deployment-target resolution for the ViteHub integration in `modules/vitehub.ts`.
 *
 * ViteHub's deployment preset is a build-time decision: it fixes the Nitro preset the build emits
 * (`node-server` for the self-hosted bundle, `vercel` for Vercel's Build Output API, and so on)
 * and the KV driver the KV Runtime Helper resolves. Nothing about it can be discovered at
 * runtime, so it is read from the environment the build runs in and defaults to the self-hosted
 * target every contributor build uses.
 */

/** The deployment targets ViteHub ships a plan for, spelled as `vite-hub`'s `DeploymentPreset`. */
export const viteHubPresets = ['cloudflare', 'deno', 'netlify', 'node', 'vercel'] as const;

export type ViteHubPreset = (typeof viteHubPresets)[number];

/** Self-hosted single-node bundle: what `aube run build` and `node .output/server/index.mjs` use. */
export const defaultViteHubPreset: ViteHubPreset = 'node';

/**
 * Resolves the ViteHub deployment preset from `VITEHUB_HOSTING` or `NITRO_PRESET`.
 *
 * Those two names are the ones ViteHub itself reads: its deployment plugin fails the build when
 * either disagrees with the configured preset, so deriving the preset from them keeps one
 * variable authoritative instead of leaving a deployment to set two that can drift. Nitro preset
 * spellings map onto ViteHub's own names (`node-server` → `node`, `cloudflare-module` →
 * `cloudflare`, `deno-deploy` → `deno`, `vercel-edge` → `vercel`).
 *
 * An unrecognised value throws rather than falling back: a silent fallback would emit the
 * self-hosted `.output/` bundle under a deployment that cannot serve it, which is exactly the
 * failure this resolution exists to prevent.
 */
export function viteHubPresetFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
): ViteHubPreset {
  const configured = (environment.VITEHUB_HOSTING ?? environment.NITRO_PRESET ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('_', '-');
  if (configured === '') return defaultViteHubPreset;

  const preset = viteHubPresets.find(
    (candidate) => configured === candidate || configured.startsWith(`${candidate}-`),
  );
  if (!preset) {
    throw new Error(
      `Unsupported deployment target ${JSON.stringify(configured)}. ` +
        `Set VITEHUB_HOSTING or NITRO_PRESET to one of: ${viteHubPresets.join(', ')}.`,
    );
  }

  return preset;
}

/**
 * Function directory `vite-hub@0.0.3`'s `vercel` deployment plan asserts on after the build
 * (`functions/__server.func/index.mjs`).
 *
 * The installed `nitropack@2.13.4` emits that function as `functions/__fallback.func` instead, and
 * its generated `config.json` routes to it under that name — nothing is wrong with the bundle,
 * only with the name ViteHub looks for. `nuxt.config.ts` bridges the two with a symlink that
 * exists just long enough for that assertion and is removed afterwards, so the deployment carries
 * one function rather than two. Drop the bridge once ViteHub's plan matches the preset's layout.
 */
export const viteHubVercelEntryName = '__server.func';

/** Resolves that alias beside whichever function directory the Nitro preset actually emitted. */
export function viteHubVercelEntryAlias(serverDirectory: string): string {
  return join(dirname(serverDirectory), viteHubVercelEntryName);
}
