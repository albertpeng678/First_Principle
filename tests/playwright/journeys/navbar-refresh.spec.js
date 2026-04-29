const { test, expect } = require('@playwright/test');
test('navbar has favicon mark and 2 tabs on desktop, no dev tool tab', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/');
  await expect(page.locator('.navbar-favicon')).toBeVisible();
  const tabs = await page.locator('.navbar-tab').allInnerTexts();
  expect(tabs).toEqual(['CIRCLES', '北極星指標']);
  expect(tabs).not.toContain('範例 Review');
});
test('navbar tabs hidden on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://localhost:4000/');
  const visible = await page.locator('.navbar-tabs').isVisible();
  expect(visible).toBe(false);
});
