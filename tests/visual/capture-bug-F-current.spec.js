// Capture Bug F current state — Phase 1 R step showing counter + parens (BEFORE fix).
// Mobile-360 + Desktop-1280 only.
const { test } = require('@playwright/test');
const fs = require('fs');

const OUT_DIR = 'audit';

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function setRStep(page) {
  await page.evaluate(() => {
    window.AppState.view = 'circles';
    window.AppState.circlesMode = 'drill';
    window.AppState.circlesDrillStep = 'R';
    window.AppState.circlesPhase = 1;
    window.AppState.circlesLocked = false;
    window.AppState.circlesStale = false;
    window.AppState.circlesGateResult = null;
    window.AppState.circlesGateLoading = false;
    window.AppState.circlesSelectedQuestion = {
      id: 'q_r_test',
      company: 'Spotify',
      product: 'Spotify Podcast',
      type: 'design',
      difficulty: '中',
      statement: '請設計改善 Podcast 留存的方案。'
    };
    window.AppState.circlesFrameworkDraft = { R: {} };
    window.render();
  });
  await page.waitForTimeout(600);
}

test.describe('Bug F current state — R step drill', () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  test('mobile-360 R step counter + parens', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await setRStep(page);
    await page.waitForSelector('.phase-head__title', { timeout: 5000 });
    await page.screenshot({ path: `${OUT_DIR}/png-bug-F-current-mobile-360.png`, fullPage: true });
  });

  test('desktop-1280 R step counter + parens', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await setRStep(page);
    await page.waitForSelector('.phase-head__title', { timeout: 5000 });
    await page.screenshot({ path: `${OUT_DIR}/png-bug-F-current-desktop-1280.png`, fullPage: true });
  });
});
