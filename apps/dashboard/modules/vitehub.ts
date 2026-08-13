import { defineNuxtModule } from 'nuxt/kit';
import viteHubNuxtModule from 'vite-hub/nuxt';

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
    await viteHubNuxtModule(
      {
        preset: 'node',
        // Local single-node default. Cloudflare KV, Deno KV, or Upstash drop in as drivers here
        // without touching application code.
        kv: { driver: 'fs-lite', base: '.data/agent-zero' },
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
