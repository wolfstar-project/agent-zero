import { expect, test } from './test-utils.js';

test.describe('Dashboard', () => {
  test('renders the frontend dashboard without runtime or hydration errors', async ({
    page,
    goto,
    hydrationErrors,
    consoleErrors,
  }) => {
    const response = await goto('/', { waitUntil: 'networkidle' });

    expect(response).not.toBeNull();
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No tasks recorded', level: 3 })).toBeVisible();
    expect(hydrationErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('refreshes local dashboard state without backend requests', async ({
    page,
    goto,
    consoleErrors,
  }) => {
    const backendRequests: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/') || path.startsWith('/rpc/')) backendRequests.push(path);
    });
    await goto('/', { waitUntil: 'networkidle' });
    const refresh = page.getByRole('button', { name: 'Refresh' });

    await refresh.click();

    await expect(refresh).toBeEnabled();
    expect(backendRequests).toHaveLength(0);
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
});
