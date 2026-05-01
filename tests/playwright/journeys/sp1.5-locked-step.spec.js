'use strict';

const { test, expect } = require('@playwright/test');

const ENV_BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('SP1.5 locked-step state (B1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENV_BASE);
    // Inject locked state via AppState (no need for real DB session)
    await page.evaluate(() => {
      window.AppState = window.AppState || {};
      window.AppState.circlesStepScores = {
        C1: { totalScore: 65, dimensions: [], highlight: 'mock', improvement: '', coachVersion: '' }
      };
      window.AppState.circlesSelectedQuestion = {
        id: 'circles_001', company: 'Spotify', product: 'Spotify Podcast',
        problem_statement: 'Locked test',
        analysis: { business: 'a', users: 'b', insight: 'c' }
      };
      window.AppState.circlesPhase = 1;
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesMode = 'drill';
      if (typeof navigate === 'function') navigate('circles');
    });
    await page.waitForTimeout(200);
  });

  test('locked banner present with score pill', async ({ page }) => {
    await expect(page.locator('.locked-banner')).toBeVisible();
    await expect(page.locator('.locked-banner .score-pill')).toContainText('65');
  });

  test('phase 1 textareas are readonly with .locked class', async ({ page }) => {
    const textareas = await page.locator('.circles-field-input').all();
    for (const t of textareas) {
      await expect(t).toHaveAttribute('readonly', /.*/);
      await expect(t).toHaveClass(/locked/);
    }
  });

  test('phase 1 submit-bar shows 「回評分」 + 「下一步」', async ({ page }) => {
    await expect(page.locator('#circles-p1-back')).toContainText('回評分');
    await expect(page.locator('#circles-p1-next-step')).toContainText('下一步');
  });

  test('phase 2 chat input disabled when locked', async ({ page }) => {
    await page.evaluate(() => { window.AppState.circlesPhase = 2; navigate('circles'); });
    await page.waitForTimeout(200);
    await expect(page.locator('#circles-msg-input')).toBeDisabled();
    await expect(page.locator('#circles-send-btn')).toBeDisabled();
  });
});
