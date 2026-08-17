import { expect, test } from '@playwright/test';

test('pricing grid matches across breakpoints', async ({ page }) => {
  await page.goto('/pricing', { waitUntil: 'networkidle' });

  const pricingGrid = page.locator('#pricing > .shell > ul');
  await expect(pricingGrid).toBeVisible();
  await expect(pricingGrid).toHaveScreenshot('pricing-grid.png', {
    animations: 'disabled',
  });
});
