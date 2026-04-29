// tests/playwright/journeys/desktop-phase3.spec.js
// Phase 4.4: CIRCLES Phase 3 score desktop layout
const { test, expect } = require('@playwright/test');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 667 };
const BASE_URL = process.env.PMD_BASE_URL || 'http://localhost:4000';

async function gotoCirclesPhase3(page) {
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
    AppState.circlesPhase = 3;
    AppState.circlesMode = 'drill';
    AppState.circlesDrillStep = 'C1';
    AppState.circlesScoreResult = {
      totalScore: 75,
      coachVersion: '示例教練版本內容',
      dimensions: [
        { name: '清晰度', score: 4, comment: '清楚說明' },
        { name: '完整度', score: 3, comment: '可加強' },
        { name: '邏輯性', score: 4, comment: '結構好' },
        { name: '可執行性', score: 3, comment: '尚需細化' },
      ],
    };
    AppState.circlesStepScores = { C1: { totalScore: 75 } };
    render();
  });
  await page.waitForTimeout(300);
}

test.describe('Phase 4.4 desktop CIRCLES Phase 3 score', () => {
  test('desktop applies phase3-desktop class', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoCirclesPhase3(page);
    await expect(page.locator('.phase3-desktop')).toHaveCount(1);
  });

  test('mobile (375) does NOT apply phase3-desktop class', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await gotoCirclesPhase3(page);
    await expect(page.locator('.phase3-desktop')).toHaveCount(0);
  });

  test('no JS console errors on desktop phase 3', async ({ page }) => {
    const errors = [];
    page.on('console', m => {
      if (m.type() === 'error' && !/Failed to load resource|404/.test(m.text())) errors.push(m.text());
    });
    await page.setViewportSize(DESKTOP);
    await gotoCirclesPhase3(page);
    expect(errors).toEqual([]);
  });
});
