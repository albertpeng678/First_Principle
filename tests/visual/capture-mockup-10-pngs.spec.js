// Capture mockup 10 PNGs — uses playwright.config.js project viewport.
// 5 state × 8 viewport = 40 PNGs total.
const { test } = require('@playwright/test');
const fs = require('fs');

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function clearOnboardingFlag(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('circles_onboarding_done'); } catch (_) {}
  });
}

test.describe('Capture mockup 10 PNGs', () => {
  fs.mkdirSync('audit/png-mockup-10', { recursive: true });

  test('welcome', async ({ page }, testInfo) => {
    await clearOnboardingFlag(page);
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.waitForSelector('.onb-welcome', { timeout: 5000 });
    await page.screenshot({ path: `audit/png-mockup-10/welcome-${testInfo.project.name}.png`, fullPage: true });
  });

  for (const step of [1, 2, 3, 4]) {
    test(`step${step}`, async ({ page }, testInfo) => {
      await clearOnboardingFlag(page);
      await setupRoutes(page);
      await page.goto('/');
      await page.waitForSelector('.qcard');
      await page.waitForSelector('.onb-welcome', { timeout: 5000 });
      await page.locator('[data-onb-action="start"]').click();
      for (var n = 1; n < step; n++) {
        await page.locator('[data-onb-action="next"]').click();
        await page.waitForTimeout(150);
      }
      await page.waitForSelector('.onb-tooltip', { timeout: 3000 });
      await page.waitForTimeout(150);
      await page.screenshot({ path: `audit/png-mockup-10/step${step}-${testInfo.project.name}.png`, fullPage: true });
    });
  }
});
