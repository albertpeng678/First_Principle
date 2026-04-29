// tests/playwright/journeys/desktop-nsm-step1-3.spec.js
// Phase 4.5: NSM Step 1, 2, 3 desktop layouts
const { test, expect } = require('@playwright/test');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 667 };
const BASE_URL = process.env.PMD_BASE_URL || 'http://localhost:4000';

async function gotoNSM(page, step) {
  await page.goto(BASE_URL + '/?guest=1');
  await page.waitForSelector('#app', { state: 'attached' });
  await page.waitForTimeout(300);
  await page.evaluate((s) => {
    AppState.view = 'nsm';
    AppState.nsmStep = s;
    if (s >= 2) {
      var nsmQs = (typeof NSM_QUESTIONS !== 'undefined' ? NSM_QUESTIONS : []);
      AppState.nsmSelectedQuestion = nsmQs[0] || { id: 'q1', company: 'Netflix', industry: '內容訂閱制', scenario: '測試情境', coach_nsm: '測試NSM', anti_patterns: [] };
    }
    document.body.dataset.view = 'nsm';
    render();
  }, step);
  await page.waitForTimeout(400);
}

test.describe('Phase 4.5 desktop NSM Step 1', () => {
  test('NSM Step 1 has nsm-home-desktop class on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoNSM(page, 1);
    await expect(page.locator('.nsm-home-desktop')).toHaveCount(1);
  });

  test('NSM Step 1 does NOT have desktop class on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await gotoNSM(page, 1);
    await expect(page.locator('.nsm-home-desktop')).toHaveCount(0);
  });
});

test.describe('Phase 4.5 desktop NSM Step 2', () => {
  test('NSM Step 2 has nsm-step2-desktop class on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoNSM(page, 2);
    await expect(page.locator('.nsm-step2-desktop')).toHaveCount(1);
  });
});

test.describe('Phase 4.5 desktop NSM Step 3', () => {
  test('NSM Step 3 has nsm-step3-desktop class on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoNSM(page, 3);
    await expect(page.locator('.nsm-step3-desktop')).toHaveCount(1);
  });
});
