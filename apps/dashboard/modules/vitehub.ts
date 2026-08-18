import { defineNuxtModule } from 'nuxt/kit';
import viteHubNuxtModule from 'vite-hub/nuxt';

import { viteHubPresetFromEnvironment } from '../config/hosting.js';

/**
 * Registers ViteHub's KV Runtime Helper inside Nuxt's own Nitro pipeline.
 *
 * `server/utils/store.ts` imports `kv` from `vite-hub/kv`; that Runtime Helper only resolves a
 * live driver when the `vitehub()` integration ran during the build that produced this app. There
 * is no published one-line `modules: ['vite-hub/nuxt']` entry for this, so this module calls the
 * installed `vite-hub/nuxt` export directly against the Nuxt instance.
 */
export default defineNuxtModule({
  meta: { name: 'agent-zero-vitehub' },
  async setup(_options, nuxt) {
    // ViteHub's deployment preset also sets Nitro's: it pins `nitro.preset` to the plan's own
    // preset during the build. Hard-coding `node` here therefore forced the self-hosted
    // `node-server` bundle even on a host with its own output contract — on Vercel that meant a
    // `.output/` directory the platform cannot serve, and a build that failed looking for `dist`.
    const preset = viteHubPresetFromEnvironment();

    await viteHubNuxtModule(
      {
        preset,
        // The filesystem driver is the self-hosted single-node default. A hosted preset gets the
        // host's own driver from ViteHub instead (Upstash on Vercel, Workers KV on Cloudflare),
        // because a serverless function has no writable `.data/agent-zero` to persist into.
        kv: preset === 'node' ? { driver: 'fs-lite', base: '.data/agent-zero' } : true,
      },
      // `vite-hub/nuxt`'s duck-typed `NuxtLike` parameter type doesn't structurally match the
      // real (generically-hookable) `Nuxt` type from `@nuxt/kit`, even though a real `Nuxt`
      // instance satisfies it at runtime — confirmed by `nuxt build` generating `.vitehub/**` and
      // `/api/dashboard` resolving a working `fs-lite` KV driver end to end.
      // oxlint-disable-next-line no-unsafe-type-assertion -- verified-safe cast, see comment above
      nuxt as unknown as Parameters<typeof viteHubNuxtModule>[1],
    );
  },
});
