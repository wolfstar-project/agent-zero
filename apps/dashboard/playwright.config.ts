import process from 'node:process';

import type { ConfigOptions } from '@nuxt/test-utils/playwright';
import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:5678';

export default defineConfig<ConfigOptions>({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['html'], ['junit', { outputFile: 'test-report.junit.xml' }]]
    : 'html',
  timeout: 120_000,
  webServer: {
    command: 'aube run start:playwright:webserver',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  use: {
    baseURL,
    trace: 'on-first-retry',
    nuxt: {
      rootDir: import.meta.dirname,
      host: baseURL,
    },
  },
  projects: [
    {
      name: 'chromium-headless-shell',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
