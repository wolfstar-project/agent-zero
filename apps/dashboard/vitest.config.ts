import { fileURLToPath } from 'node:url';

import { defineVitestProject } from '@nuxt/test-utils/config';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/**
 * Two Vitest projects, mirroring the split wolfstar.rocks and npmx.dev use:
 *
 * - `unit` runs pure logic in a plain Node environment with the Nuxt path aliases mapped
 *   manually, so no app build is needed.
 * - `nuxt` boots the real app runtime through `@nuxt/test-utils`, so component and composable
 *   specs exercise the same i18n, auth, and auto-import wiring the dashboard ships with. The DOM
 *   comes from happy-dom rather than a real browser: CI installs no browser binaries for the
 *   unit-test job, and the flows under test have no need for one.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '~': fileURLToPath(new URL('./app', import.meta.url)),
            '~~': rootDir,
            '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
          },
        },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.{test,spec}.ts', '{app,config,shared}/**/*.{test,spec}.ts'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          environment: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          setupFiles: ['./test/nuxt/setup.ts'],
          environmentOptions: {
            nuxt: {
              rootDir,
              domEnvironment: 'happy-dom',
              overrides: {
                runtimeConfig: {
                  public: {
                    // Point the Better Auth client at the test environment's mock server instead
                    // of the real auth adapter origin, so session fetches stay off the network
                    // and resolve through `registerEndpoint` (see test/nuxt/setup.ts).
                    siteUrl: '',
                  },
                },
              },
            },
          },
        },
      }),
    ],
  },
});
