/**
 * capture-mockup-16-resume-pngs.spec.js
 * 3 toast variants × 8 viewports = 24 PNGs
 * Output dir: audit/png-mockup-16-resume/
 */

const { test } = require('@playwright/test');
const fs = require('fs');

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('Capture mockup 16 §D resume-toast PNGs', () => {
  fs.mkdirSync('audit/png-mockup-16-resume', { recursive: true });

  // Toast variant 1: CIRCLES eval in-flight, user on NSM
  test('toast-circles-eval', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.circlesEvaluating = true;
      window.AppState.circlesPhase = 3;
      window.AppState.view = 'nsm';
      window.AppState.evalToastDismissed = false;
      window.AppState.circlesSession = { id: 'sess-001' };
      window.render();
    });
    await page.waitForSelector('[data-resume-toast-wrap]', { timeout: 5000 });
    await page.screenshot({
      path: `audit/png-mockup-16-resume/toast-circles-eval-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  // Toast variant 2: NSM gate loading, user on CIRCLES home
  test('toast-nsm-gate', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState.nsmGateLoading = true;
      window.AppState.nsmStep = 2;
      window.AppState.view = 'circles';
      window.AppState.evalToastDismissed = false;
      window.render();
    });
    await page.waitForSelector('[data-resume-toast-wrap]', { timeout: 5000 });
    await page.screenshot({
      path: `audit/png-mockup-16-resume/toast-nsm-gate-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  // Toast variant 3: Phase 4 final-report in-flight, user on NSM
  test('toast-phase4-report', async ({ page }, testInfo) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.waitForSelector('.qcard');
    await page.evaluate(() => {
      window.AppState._phase4FinalReportFired = true;
      window.AppState.circlesFinalReport = null;
      window.AppState.circlesPhase4Error = null;
      window.AppState.circlesPhase = 4;
      window.AppState.view = 'nsm';
      window.AppState.evalToastDismissed = false;
      window.render();
    });
    await page.waitForSelector('[data-resume-toast-wrap]', { timeout: 5000 });
    await page.screenshot({
      path: `audit/png-mockup-16-resume/toast-phase4-report-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});
