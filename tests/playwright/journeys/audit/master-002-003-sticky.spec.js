// @ts-check
const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('M-002 展開題目卡 sticky 確認鈕', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('iPhone-SE 展開題目卡時 確認按鈕在 fold 內', async ({ page }) => {
    await page.goto(BASE_URL + '/?onboarding=0');
    await page.waitForLoadState('networkidle');
    const card = page.locator('.circles-q-card').first();
    await card.waitFor({ state: 'visible', timeout: 5000 });
    await card.click(); // 展開
    const btn = page.locator('.circles-q-confirm-btn').first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    const bottom = await btn.evaluate(el => el.getBoundingClientRect().bottom);
    const vh = await page.evaluate(() => window.innerHeight);
    expect(bottom).toBeLessThanOrEqual(vh);
  });
});

test.describe('M-003 Phase-2 結論預覽 sticky 行動列', () => {
  for (const vp of [
    { name: 'iPhone-SE', width: 375, height: 667 },
    { name: 'Desktop-1280', width: 1280, height: 800 },
  ]) {
    test('結論預覽 action row 在 fold 內 — ' + vp.name, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL + '/?onboarding=0');
      await page.waitForLoadState('networkidle');
      // 直接走 setState 跳到 conclusion-expanded
      await page.evaluate(() => {
        if (typeof AppState === 'undefined') return;
        AppState.view = 'circles';
        AppState.circlesPhase = 2;
        AppState.circlesSelectedQuestion = (typeof CIRCLES_QUESTIONS !== 'undefined' ? CIRCLES_QUESTIONS[0] : null);
        AppState.circlesMode = 'drill';
        AppState.circlesDrillStep = 'C1';
        AppState.circlesSubmitState = 'expanded';
        if (typeof render === 'function') render();
      });
      await page.waitForTimeout(400);
      const submit = page.locator('#circles-conclusion-submit');
      await submit.waitFor({ state: 'visible', timeout: 5000 });
      const bottom = await submit.evaluate(el => el.getBoundingClientRect().bottom);
      const vh = await page.evaluate(() => window.innerHeight);
      expect(bottom).toBeLessThanOrEqual(vh);
    });
  }
});
