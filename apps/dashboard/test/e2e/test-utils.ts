import { expect, test as base } from '@nuxt/test-utils/playwright';
import type { ConsoleMessage } from '@playwright/test';

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
