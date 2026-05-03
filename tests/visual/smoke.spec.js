const { test, expect } = require('@playwright/test');

test.describe('Path 2 Plan A smoke', () => {
  test('app boots without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.waitForSelector('.navbar', { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('navbar renders with brand + icon button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.navbar');
    const brand = page.locator('.navbar__brand-name');
    await expect(brand).toHaveText('PM Drill');
    await expect(page.locator('.navbar__brand-icon i.ph-circles-three')).toBeVisible();
  });

  test('view router switches between circles / nsm', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-view]');
    const initial = await page.locator('[data-view]').first().getAttribute('data-view');
    expect(['circles', 'nsm', 'auth']).toContain(initial);
    await page.evaluate(() => { window.AppState.view = 'nsm'; window.render(); });
    await expect(page.locator('[data-view="nsm"]')).toBeVisible();
  });
});
