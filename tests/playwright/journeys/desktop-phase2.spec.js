// tests/playwright/journeys/desktop-phase2.spec.js
// Phase 4.3: CIRCLES Phase 2 chat desktop layout
const { test, expect } = require('@playwright/test');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 667 };
const BASE_URL = process.env.PMD_BASE_URL || 'http://localhost:4000';

async function gotoCirclesPhase2(page) {
  await page.goto(BASE_URL + '/?guest=1');
  await page.waitForSelector('#app', { state: 'attached' });
  await page.waitForFunction(() => {
    return document.querySelector('.circles-home-desktop, .circles-home-wrap');
  }, { timeout: 5000 });
  await page.evaluate(() => {
    var qs = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS : []);
    var q = qs[0];
    if (!q) return;
    AppState.circlesSelectedQuestion = q;
    AppState.circlesPhase = 2;
    AppState.circlesMode = 'drill';
    AppState.circlesDrillStep = 'C1';
    AppState.circlesConversation = [];
    AppState.circlesSubmitState = null;
    render();
  });
  await page.waitForTimeout(300);
}

test.describe('Phase 4.3 desktop CIRCLES Phase 2 chat', () => {
  test('desktop applies phase2-desktop class', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoCirclesPhase2(page);
    await expect(page.locator('.phase2-desktop')).toHaveCount(1);
  });

  test('desktop chat-wrap exists with both classes', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoCirclesPhase2(page);
    await expect(page.locator('.circles-chat-wrap.phase2-desktop')).toHaveCount(1);
  });

  test('mobile (375) does NOT apply phase2-desktop class', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await gotoCirclesPhase2(page);
    await expect(page.locator('.phase2-desktop')).toHaveCount(0);
    // Mobile still has chat-wrap
    await expect(page.locator('.circles-chat-wrap')).toHaveCount(1);
  });
});
