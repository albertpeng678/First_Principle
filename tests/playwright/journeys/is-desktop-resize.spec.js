const { test, expect } = require('@playwright/test');
test('window resize triggers re-render across breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/');
  let val = await page.evaluate(() => window.AppState._lastIsDesktop);
  expect(val).toBe(true);
  await page.setViewportSize({ width: 800, height: 800 });
  await page.waitForTimeout(300);
  val = await page.evaluate(() => window.AppState._lastIsDesktop);
  expect(val).toBe(false);
});
