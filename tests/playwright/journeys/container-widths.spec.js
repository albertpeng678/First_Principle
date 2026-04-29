const { test, expect } = require('@playwright/test');
test('app container desktop has no max-width (per-page handled)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/');
  const maxW = await page.locator('#app').evaluate(el => getComputedStyle(el).maxWidth);
  expect(maxW).toBe('none');
});
test('mobile keeps full width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://localhost:4000/');
  const maxW = await page.locator('#app').evaluate(el => getComputedStyle(el).maxWidth);
  expect(maxW).toBe('100%');
});
