'use strict';
const { test, expect } = require('@playwright/test');
const ENV_BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('SP1.5-bugfix banner merged', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENV_BASE);
    await page.evaluate(() => {
      window.AppState = window.AppState || {};
      window.AppState.circlesStale = true;
      window.AppState.circlesSelectedQuestion = {
        id: 'circles_001', company: 'Spotify', product: 'Spotify Podcast',
        problem_statement: 'Stale snapshot statement', analysis: { business: '', users: '', insight: '' }
      };
      window.AppState.circlesSession = { id: 'mock', mode: 'drill', drill_step: 'C1' };
      window.AppState.circlesPhase = 2;
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesStepScores = { C1: { totalScore: 65 } };
      if (typeof navigate === 'function') navigate('circles');
    });
    await page.waitForTimeout(200);
  });

  test('only .stale-locked-bar visible (no separate .locked-banner + .stale-banner)', async ({ page }) => {
    await expect(page.locator('.stale-locked-bar')).toBeVisible();
    await expect(page.locator('.locked-banner')).toHaveCount(0);
    await expect(page.locator('.stale-banner')).toHaveCount(0);
  });

  test('locked score pill visible inside merged banner', async ({ page }) => {
    await expect(page.locator('.stale-locked-bar .pill')).toContainText('65');
  });

  test('phase 1 stale banner has no pill (no score yet)', async ({ page }) => {
    await page.evaluate(() => { window.AppState.circlesPhase = 1; window.AppState.circlesStepScores = {}; navigate('circles'); });
    await page.waitForTimeout(200);
    await expect(page.locator('.stale-locked-bar')).toBeVisible();
    await expect(page.locator('.stale-locked-bar .pill')).toHaveCount(0);
  });
});
