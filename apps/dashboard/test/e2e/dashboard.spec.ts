import { expect, mockAuthSession, test } from './test-utils.js';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page, true);
  });

  test('renders the frontend dashboard without runtime or hydration errors', async ({
    page,
    goto,
    hydrationErrors,
    consoleErrors,
  }) => {
    const response = await goto('/', { waitUntil: 'networkidle' });

    expect(response).not.toBeNull();
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Control Plane', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No tasks recorded', level: 3 })).toBeVisible();
    expect(hydrationErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('refreshes local dashboard state without requests beyond the auth origin', async ({
    page,
    goto,
    consoleErrors,
  }) => {
    // The dashboard owns no backend of its own. Authentication is the single sanctioned network
    // dependency, and it lives on a separate origin, so nothing may hit a local API or RPC route.
    const localBackendRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== new URL(page.url() || 'http://localhost').origin) return;
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rpc/')) {
        localBackendRequests.push(url.pathname);
      }
    });
    await goto('/', { waitUntil: 'networkidle' });
    const refresh = page.getByRole('button', { name: 'Refresh' });

    await refresh.click();

    await expect(refresh).toBeEnabled();
    expect(localBackendRequests).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('switches between persistent light and dark themes', async ({
    page,
    goto,
    hydrationErrors,
    consoleErrors,
  }) => {
    await page.addInitScript({
      content:
        "if (!localStorage.getItem('agent-zero-color-mode')) localStorage.setItem('agent-zero-color-mode', 'dark')",
    });
    await goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(hydrationErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('translates the interface when the locale changes', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'No tasks recorded', level: 3 })).toBeVisible();

    await page.getByRole('combobox', { name: 'Language' }).selectOption('it');

    await expect(
      page.getByRole('heading', { name: 'Nessun task registrato', level: 3 }),
    ).toBeVisible();
  });
});
