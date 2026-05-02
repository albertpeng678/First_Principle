'use strict';
const { test, expect } = require('@playwright/test');
const ENV_BASE = process.env.PMDRILL_BASE_URL || 'http://localhost:4000';

test.describe('SP1.5-bugfix D-1 desktop layout split', () => {
  test('navbar + circles-progress full-width; chat-body ≤ 920px', async ({ page }) => {
    await page.goto(ENV_BASE);
    await page.evaluate(() => {
      window.AppState = window.AppState || {};
      window.AppState.circlesSelectedQuestion = { id: 'q', company: 'Spotify', product: 'Spotify Podcast', problem_statement: 'X', analysis: {} };
      window.AppState.circlesSession = { id: 'mock', mode: 'drill', drill_step: 'C1' };
      window.AppState.circlesPhase = 2;
      window.AppState.circlesDrillStep = 'C1';
      window.AppState.circlesMode = 'drill';
      if (typeof navigate === 'function') navigate('circles');
    });
    await page.waitForTimeout(300);

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const navbarW = await page.locator('.navbar').first().evaluate(el => el.getBoundingClientRect().width);
    const progressW = await page.locator('.circles-progress').first().evaluate(el => el.getBoundingClientRect().width);

    // Top chrome should match viewport (full-width). Allow 10px tolerance for scrollbars.
    expect(navbarW).toBeGreaterThanOrEqual(viewportWidth - 10);
    expect(progressW).toBeGreaterThanOrEqual(viewportWidth - 10);

    // body-centered ≤ 920px when viewport > 920
    if (viewportWidth > 920) {
      const bodyW = await page.locator('.circles-body-centered').first().evaluate(el => el.getBoundingClientRect().width);
      expect(bodyW).toBeLessThanOrEqual(920);
    }
  });
});
