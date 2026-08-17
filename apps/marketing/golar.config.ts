import { defineConfig } from 'golar/unstable';
import '@golar/vue';

// `nuxt typecheck` picks this checker up automatically once this file exists (Nuxt 4.5+,
// https://nuxt.com/blog/v4-5#%EF%B8%8F-nuxt-cli). Golar is built on typescript-go, the same engine
// this repo already pins `typescript` to (`typescript-native-bridge` in pnpm-workspace.yaml), so it
// replaces vue-tsc rather than adding a second, differently-engined checker alongside it.
export default defineConfig({
  typecheck: {
    // `.d.ts` isn't covered by `**/*.ts`: it's needed for `pwa-assets.d.ts`'s ambient
    // `virtual:pwa-assets/*` module declarations to be visible while checking the
    // `.nuxt/pwa-icons-plugin.ts` Nuxt generates from those modules.
    include: ['**/*.ts', '**/*.vue', '**/*.d.ts'],
    exclude: ['**/dist/**', '**/.output/**', '**/node_modules/**'],
  },
});
