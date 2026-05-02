'use strict';
const { test, expect } = require('@playwright/test');
const ENV_BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('SP1.5-bugfix action-bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENV_BASE);
    await page.evaluate(() => {
      window.AppState = window.AppState || {};
      window.AppState.circlesStale = true;
      window.AppState.circlesSelectedQuestion = { id: 'q', company: 'X', product: 'Y', problem_statement: 'Z', analysis: {} };
      window.AppState.circlesSession = { id: 'mock', mode: 'drill', drill_step: 'C1' };
      window.AppState.circlesPhase = 2;
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesMode = 'drill';
      window.AppState.circlesStepScores = { C1: { totalScore: 65 } };
      if (typeof navigate === 'function') navigate('circles');
    });
    await page.waitForTimeout(200);
  });

  test('phase 2 上一步 click → phase 1', async ({ page }) => {
    await page.locator('#circles-stale-prev').click();
    await page.waitForTimeout(200);
    const phase = await page.evaluate(() => window.AppState.circlesPhase);
    expect(phase).toBe(1);
  });

  test('phase 3 上一步 click → phase 2', async ({ page }) => {
    await page.evaluate(() => {
      window.AppState.circlesPhase = 3;
      window.AppState.circlesScoreResult = { totalScore: 65, dimensions: [], coachVersion: '' };
      navigate('circles');
    });
    await page.waitForTimeout(200);
    await page.locator('#circles-stale-prev').click();
    await page.waitForTimeout(200);
    const phase = await page.evaluate(() => window.AppState.circlesPhase);
    expect(phase).toBe(2);
  });

  test('回首頁 click → CIRCLES home (NOT legacy)', async ({ page }) => {
    await page.locator('#circles-stale-home').click();
    await page.waitForTimeout(200);
    const view = await page.evaluate(() => window.AppState.view);
    expect(view).toBe('circles');
    await expect(page.locator('text=選擇難度')).toHaveCount(0);
    await expect(page.locator('.diff-list')).toHaveCount(0);
  });
});
