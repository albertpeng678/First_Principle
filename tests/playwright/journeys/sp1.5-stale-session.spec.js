'use strict';

const { test, expect } = require('@playwright/test');

const ENV_BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('SP1.5 stale session (Q3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENV_BASE);
    await page.evaluate(() => {
      window.AppState = window.AppState || {};
      window.AppState.circlesStale = true;  // simulate drift detected
      window.AppState.circlesSelectedQuestion = {
        id: 'circles_001', company: 'Spotify', product: 'Spotify播放列表推薦',
        problem_statement: 'Spotify 用戶在創建新播放列表後，對於如何填充內容感到困惑…如何設計一個功能幫助新用戶快速建立符合他們品味的播放列表？',
        analysis: { business: 'mock', users: 'mock', insight: 'mock' }
      };
      window.AppState.circlesSession = { id: 'mock-test-session-id', mode: 'drill', drill_step: 'C1' };
      window.AppState.circlesPhase = 1;
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesMode = 'drill';
      if (typeof navigate === 'function') navigate('circles');
    });
    await page.waitForTimeout(200);
  });

  test('stale banner visible', async ({ page }) => {
    await expect(page.locator('.stale-banner')).toBeVisible();
    await expect(page.locator('.stale-banner strong')).toContainText('此題目已被更新');
  });

  test('phase 1 fields are readonly when stale', async ({ page }) => {
    const textareas = await page.locator('.circles-field-input').all();
    for (const t of textareas) {
      await expect(t).toHaveAttribute('readonly', /.*/);
    }
  });

  test('phase 2 chat input not rendered when stale (bottom-bar simplified)', async ({ page }) => {
    await page.evaluate(() => { window.AppState.circlesPhase = 2; navigate('circles'); });
    await page.waitForTimeout(200);
    // When stale, bottomSection is replaced with single 「回首頁」 button — no chat input.
    await expect(page.locator('#circles-msg-input')).toHaveCount(0);
    await expect(page.locator('#circles-stale-home')).toBeVisible();
  });

  test('snapshot product+statement displayed (not current DB content)', async ({ page }) => {
    // The snapshot mock has product = "Spotify播放列表推薦" — ensure UI shows that, NOT "Spotify Podcast"
    const productText = await page.locator('.circles-q-card-product, .circles-nav-sub').first().textContent();
    expect(productText).toContain('Spotify播放列表推薦');
  });

  test('only 「回首頁」 button at bottom', async ({ page }) => {
    await expect(page.locator('#circles-stale-home')).toBeVisible();
    await expect(page.locator('#circles-stale-home')).toContainText('回首頁');
  });
});
