'use strict';
const { test, expect } = require('@playwright/test');
const ENV_BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test('SP1.5-bugfix phase 3 stale-home button is primary (not icon-btn round grey)', async ({ page }) => {
  await page.goto(ENV_BASE);
  await page.evaluate(() => {
    window.AppState = window.AppState || {};
    window.AppState.circlesStale = true;
    window.AppState.circlesSelectedQuestion = { id: 'q', company: 'X', product: 'Y', problem_statement: 'Z', analysis: {} };
    window.AppState.circlesSession = { id: 'mock', mode: 'drill', drill_step: 'C1' };
    window.AppState.circlesPhase = 3;
    window.AppState.circlesDrillStep = 'C1';
    window.AppState.circlesMode = 'drill';
    window.AppState.circlesStepScores = { C1: { totalScore: 65 } };
    window.AppState.circlesScoreResult = { totalScore: 65, dimensions: [], coachVersion: '' };
    if (typeof navigate === 'function') navigate('circles');
  });
  await page.waitForTimeout(200);

  const btn = page.locator('#circles-stale-home');
  await expect(btn).toBeVisible();

  const bg = await btn.evaluate(el => getComputedStyle(el).backgroundColor);
  // icon-btn grey = rgb(243, 244, 246); transparent = rgba(0,0,0,0). Neither acceptable for primary.
  expect(bg).not.toBe('rgb(243, 244, 246)');
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  // primary blue = var(--c-primary) → rgb(26, 86, 219)
  expect(bg).toBe('rgb(26, 86, 219)');

  const radius = await btn.evaluate(el => getComputedStyle(el).borderRadius);
  // Should not be 50% (icon-btn round)
  expect(radius).not.toBe('50%');
});
