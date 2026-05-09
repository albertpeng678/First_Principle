/**
 * cross-tab-resume-toast.spec.js — Mockup 16 §D cross-tab in-flight resume-toast
 * 6 specs: CIRCLES eval / NSM gate / Phase 4 toast visibility + interactions
 * All specs target Desktop-1280 for functional coverage; 8-vp via playwright.config.js
 */

const { test, expect } = require('@playwright/test');

async function setupRoutes(page) {
  await page.route('**/api/circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/guest-circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/circles-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/guest/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/nsm-sessions**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function goToBase(page) {
  await setupRoutes(page);
  await page.goto('/');
  await page.waitForSelector('.qcard');
}

// ── Spec 1: Phase 3 evaluating + switch to NSM → toast visible ───────────────
test('spec-1: circlesEvaluating=true + NSM view → resume-toast shows CIRCLES copy', async ({ page }) => {
  await goToBase(page);
  await page.evaluate(() => {
    window.AppState.circlesEvaluating = true;
    window.AppState.circlesPhase = 3;
    window.AppState.view = 'nsm';
    window.AppState.evalToastDismissed = false;
    window.AppState.circlesSession = { id: 'sess-001' };
    window.render();
  });
  await page.waitForSelector('[data-resume-toast-wrap]', { timeout: 3000 });
  const toast = page.locator('[data-resume-toast-wrap]');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('CIRCLES 評分仍在背景進行中');
  // Close button present
  await expect(toast.locator('[data-resume-toast="dismiss"]')).toBeVisible();
  // Spinning icon present
  await expect(toast.locator('.resume-toast__icon')).toBeVisible();
});

// ── Spec 2: Click toast body → navigate back to circles phase 3 ──────────────
test('spec-2: click toast body → navigate to circles phase 3 view', async ({ page }) => {
  await goToBase(page);
  await page.evaluate(() => {
    window.AppState.circlesEvaluating = true;
    window.AppState.circlesPhase = 3;
    window.AppState.view = 'nsm';
    window.AppState.evalToastDismissed = false;
    window.AppState.circlesSession = { id: 'sess-001' };
    window.AppState.circlesScoreResult = null;
    window.AppState.circlesPhase3Error = null;
    window.render();
  });
  await page.waitForSelector('[data-resume-toast="navigate"]', { timeout: 3000 });
  await page.click('[data-resume-toast="navigate"]');
  // Should be on circles view with phase 3 loading (circlesEvaluating still true)
  await expect(page.locator('[data-view="circles"][data-phase="3"]')).toBeVisible({ timeout: 3000 });
  // Toast should no longer show (we are now on circles phase 3 view)
  await expect(page.locator('[data-resume-toast-wrap]')).not.toBeVisible();
});

// ── Spec 3: Click toast X → toast hides (evalToastDismissed = true) ──────────
test('spec-3: click dismiss X → toast hides without navigating', async ({ page }) => {
  await goToBase(page);
  await page.evaluate(() => {
    window.AppState.circlesEvaluating = true;
    window.AppState.circlesPhase = 3;
    window.AppState.view = 'nsm';
    window.AppState.evalToastDismissed = false;
    window.AppState.circlesSession = { id: 'sess-001' };
    window.render();
  });
  await page.waitForSelector('[data-resume-toast="dismiss"]', { timeout: 3000 });
  await page.click('[data-resume-toast="dismiss"]');
  // Toast gone
  await expect(page.locator('[data-resume-toast-wrap]')).not.toBeVisible();
  // Still on NSM view (did not navigate away)
  const view = await page.evaluate(() => window.AppState.view);
  expect(view).toBe('nsm');
  // evalToastDismissed is true
  const dismissed = await page.evaluate(() => window.AppState.evalToastDismissed);
  expect(dismissed).toBe(true);
});

// ── Spec 4: Evaluation completes while user on NSM → toast hides, phase 3 score ready ──
test('spec-4: evaluation completes → toast auto-hides when circlesEvaluating flips false', async ({ page }) => {
  await goToBase(page);
  // Set up: evaluating in-flight, user on NSM
  await page.evaluate(() => {
    window.AppState.circlesEvaluating = true;
    window.AppState.circlesPhase = 3;
    window.AppState.view = 'nsm';
    window.AppState.evalToastDismissed = false;
    window.AppState.circlesSession = { id: 'sess-001' };
    window.render();
  });
  await page.waitForSelector('[data-resume-toast-wrap]', { timeout: 3000 });
  // Simulate evaluation completing (API returned result)
  await page.evaluate(() => {
    window.AppState.circlesEvaluating = false;
    window.AppState.circlesScoreResult = { totalScore: 78, dimensions: [] };
    window.AppState.evalToastDismissed = false;
    window.render();
  });
  // Toast should be gone (circlesEvaluating now false)
  await expect(page.locator('[data-resume-toast-wrap]')).not.toBeVisible();
  // Navigate to circles — should show score (phase 3 + score result exists)
  await page.evaluate(() => {
    window.AppState.view = 'circles';
    window.render();
  });
  await expect(page.locator('[data-view="circles"][data-phase="3"]')).toBeVisible({ timeout: 3000 });
});

// ── Spec 5: NSM gate loading + switch to CIRCLES → NSM resume-toast visible ──
test('spec-5: nsmGateLoading=true + CIRCLES view → NSM resume-toast shows', async ({ page }) => {
  await goToBase(page);
  await page.evaluate(() => {
    window.AppState.nsmGateLoading = true;
    window.AppState.nsmStep = 2;
    window.AppState.view = 'circles';
    window.AppState.evalToastDismissed = false;
    window.render();
  });
  await page.waitForSelector('[data-resume-toast-wrap]', { timeout: 3000 });
  const toast = page.locator('[data-resume-toast-wrap]');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('NSM 審核仍在背景進行中');
});

// ── Spec 6: Phase 4 fetching + switch to NSM → Phase 4 resume-toast visible ─
test('spec-6: phase4 in-flight + NSM view → Phase 4 resume-toast shows', async ({ page }) => {
  await goToBase(page);
  await page.evaluate(() => {
    window.AppState._phase4FinalReportFired = true;
    window.AppState.circlesFinalReport = null;
    window.AppState.circlesPhase4Error = null;
    window.AppState.circlesPhase = 4;
    window.AppState.view = 'nsm';
    window.AppState.evalToastDismissed = false;
    window.render();
  });
  await page.waitForSelector('[data-resume-toast-wrap]', { timeout: 3000 });
  const toast = page.locator('[data-resume-toast-wrap]');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('總結報告生成中');
});
