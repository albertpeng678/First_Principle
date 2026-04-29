// tests/playwright/journeys/desktop-review-login.spec.js
// Phase 4.7: review-examples + login desktop layouts
const { test, expect } = require('@playwright/test');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 667 };
const BASE_URL = process.env.PMD_BASE_URL || 'http://localhost:4000';

test.describe('Phase 4.7 desktop login', () => {
  test('login page has login-desktop wrapper at desktop viewport', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(BASE_URL + '/?guest=1');
    await page.waitForSelector('#app');
    await page.evaluate(() => {
      AppState.view = 'login';
      AppState.mode = 'auth';
      document.body.dataset.view = 'login';
      render();
    });
    await page.waitForTimeout(200);
    await expect(page.locator('.login-desktop')).toHaveCount(1);
    await expect(page.locator('.login-card')).toHaveCount(1);
  });

  test('login page does NOT have login-desktop on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto(BASE_URL + '/?guest=1');
    await page.waitForSelector('#app');
    await page.evaluate(() => {
      AppState.view = 'login';
      AppState.mode = 'auth';
      document.body.dataset.view = 'login';
      render();
    });
    await page.waitForTimeout(200);
    await expect(page.locator('.login-desktop')).toHaveCount(0);
  });
});

test.describe('Phase 4.7 desktop review-examples', () => {
  test('review-examples has review-desktop wrapper', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(BASE_URL + '/review-examples.html');
    await page.waitForSelector('.container');
    await expect(page.locator('.container.review-desktop')).toHaveCount(1);
  });
});
