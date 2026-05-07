// tests/visual/home-stats-guest.spec.js
// RED — will fail because frontend still calls /api/circles-stats for guest (401 → silent return).
const { test, expect } = require('@playwright/test');

test.describe('Home stats-strip — guest user (Bug A)', () => {
  async function setupGuest(page, statsBody) {
    // Stub auth-required endpoint as 401 (matches real backend behaviour)
    await page.route('**/api/circles-stats**', r => r.fulfill({ status: 401, body: '{}' }));
    // Stub guest endpoint with seeded counts
    await page.route('**/api/guest-circles-stats**', r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(statsBody),
    }));
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
  }

  test('Mobile-360 — guest sees seeded stats (5 / 2 / 3)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setupGuest(page, { completed: 5, active: 2, weeklyCompleted: 3 });
    // wait for fetch to settle
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-stat="completed"]');
      return el && el.textContent.trim() === '5';
    }, { timeout: 3000 });
    await expect(page.locator('[data-stat="completed"]').first()).toHaveText('5');
    await expect(page.locator('[data-stat="active"]').first()).toHaveText('2');
    await expect(page.locator('[data-stat="weekly"]').first()).toHaveText('3');
  });

  test('iPad — guest sees seeded stats (5 / 2 / 3)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setupGuest(page, { completed: 5, active: 2, weeklyCompleted: 3 });
    await page.waitForFunction(() => document.querySelector('[data-stat="completed"]')?.textContent.trim() === '5', { timeout: 3000 });
    await expect(page.locator('[data-stat="completed"]').first()).toHaveText('5');
  });

  test('Desktop-1280 — guest sees seeded stats (5 / 2 / 3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupGuest(page, { completed: 5, active: 2, weeklyCompleted: 3 });
    await page.waitForFunction(() => document.querySelector('[data-stat="completed"]')?.textContent.trim() === '5', { timeout: 3000 });
    await expect(page.locator('[data-stat="completed"]').first()).toHaveText('5');
  });

  test('frontend hits /api/guest-circles-stats not /api/circles-stats for guest', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const calledPaths = [];
    await page.route('**/api/circles-stats**', r => { calledPaths.push('auth'); r.fulfill({ status: 401, body: '{}' }); });
    await page.route('**/api/guest-circles-stats**', r => { calledPaths.push('guest'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ completed: 1, active: 1, weeklyCompleted: 0 }) }); });
    await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.waitForTimeout(500);
    expect(calledPaths).toContain('guest');
    expect(calledPaths).not.toContain('auth');
  });
});
