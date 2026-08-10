import { expect, test as base } from '@nuxt/test-utils/playwright';
import type { ConsoleMessage, Page } from '@playwright/test';

/**
 * Origin the dashboard talks to for authentication. Must match the `siteUrl` default in
 * `config/index.ts`, since the auth adapter is a separate service and is not started for e2e.
 */
const AUTH_ORIGIN = 'http://localhost:3001';

const AUTHENTICATED_SESSION = {
  user: {
    id: 'user_e2e',
    email: 'operator@example.test',
    name: 'Operator',
    emailVerified: true,
    image: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  session: {
    id: 'session_e2e',
    token: 'token_e2e',
    userId: 'user_e2e',
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

/**
 * Stand in for `apps/auth-server`.
 *
 * The adapter owns a database and a signing secret, so booting it for e2e would make the suite
 * depend on mutable external state. Intercepting its origin keeps the run deterministic while
 * still exercising the real client-side route protection.
 */
export async function mockAuthSession(page: Page, signedIn: boolean): Promise<void> {
  await page.route(`${AUTH_ORIGIN}/api/auth/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith('/get-session')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(signedIn ? AUTHENTICATED_SESSION : null),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

const hydrationMismatchPatterns = [
  'Hydration completed but contains mismatches',
  'Hydration text content mismatch',
  'Hydration node mismatch',
  'Hydration children mismatch',
  'Hydration attribute mismatch',
  'Hydration class mismatch',
  'Hydration style mismatch',
];

function isHydrationMismatch(message: ConsoleMessage): boolean {
  return hydrationMismatchPatterns.some((pattern) => message.text().includes(pattern));
}

function isApplicationConsoleError(message: ConsoleMessage): boolean {
  return (
    message.type() === 'error' ||
    (message.type() === 'warning' && message.text().includes('[nuxt]'))
  );
}

export const test = base.extend<{ hydrationErrors: string[]; consoleErrors: string[] }>({
  hydrationErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (isHydrationMismatch(message)) errors.push(message.text());
    });
    await use(errors);
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (isApplicationConsoleError(message)) errors.push(message.text());
    });
    await use(errors);
  },
});

export { expect };
