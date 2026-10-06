import { expect, test } from '@playwright/test';

test('the test build boots and exposes the dev hook', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __ig?: unknown }).__ig))).toBe(true);
});
