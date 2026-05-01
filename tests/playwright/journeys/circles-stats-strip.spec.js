// tests/playwright/journeys/circles-stats-strip.spec.js
// Task 8: Stats strip visual gate — verify .pmd-stats appears only for logged-in users

const { test, expect } = require('@playwright/test');

test.describe('CIRCLES home — stats strip', () => {
  test('logged-in user sees stats strip with 3 stats', async ({ page }) => {
    // FIXME: Integration with Supabase test user fixture pending
    // Current approach: test will fail until login mechanism is available
    // Once available, replace goto with authenticated session or loginAs query param

    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');

    const strip = page.locator('.pmd-stats');
    await expect(strip).toBeVisible();
    await expect(strip.locator('.pmd-stat')).toHaveCount(3);
    await expect(strip.locator('.pmd-stat-label').nth(0)).toHaveText('已完成');
    await expect(strip.locator('.pmd-stat-label').nth(1)).toHaveText('進行中');
    await expect(strip.locator('.pmd-stat-label').nth(2)).toContainText('本週');

    await page.screenshot({ path: 'test-results/strip-happy.png', fullPage: false });
  });

  test('guest does NOT see stats strip', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    await expect(page.locator('.pmd-stats')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/strip-guest-hidden.png' });
  });

  test('API failure: strip removed', async ({ page }) => {
    // FIXME: Integration with Supabase test user fixture pending
    // Once available, route intercept + logged-in session will be combined

    await page.route('**/api/circles-stats', route => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/');
    await page.waitForSelector('[data-view="circles"]');
    await expect(page.locator('.pmd-stats')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/strip-api-error.png' });
  });
});
