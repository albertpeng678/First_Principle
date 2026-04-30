// master-019-020-phase4.spec.js
// Wave A fix-A5 — TDD spec for:
//   M-019  Phase-1 Step S sub-tabs must render on BOTH mobile and desktop
//   M-020  Phase-4 final-report must expose `#btn-export-png` (PNG export)
//
// Generated 2026-04-30. 6 cases × multiple viewports.

const { test, expect } = require('@playwright/test');

const PHONE = ['Mobile-360', 'iPhone-SE', 'iPhone-14'];
const WIDE  = ['Desktop-1280', 'Desktop-1440'];

function only(testInfo, names) {
  test.skip(!names.includes(testInfo.project.name), `only ${names.join(',')}`);
}

// Drive the SPA into CIRCLES sim mode + phase 1 + step S, without the full UI flow.
async function gotoStepS(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    window.AppState.circlesMode = 'simulation';
    window.AppState.circlesSelectedQuestion = {
      id: 'audit-A5',
      company: 'TestCo',
      product: 'TestProduct',
      problem_statement: '請設計一個 PM 訓練題目',
    };
    window.AppState.circlesPhase = 1;
    window.AppState.circlesSimStep = 6; // S step
    window.AppState.circlesSStep = 1;
    window.AppState.view = 'circles';
    window.render();
  });
  await page.waitForSelector('[data-view="circles"]', { timeout: 5000 });
}

// Drive the SPA to Phase-4 final report with a stub report payload.
async function gotoFinalReport(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    window.AppState.circlesMode = 'simulation';
    window.AppState.circlesSelectedQuestion = {
      id: 'audit-A5',
      company: 'TestCo',
      product: 'TestProduct',
      problem_statement: '請設計一個 PM 訓練題目',
    };
    window.AppState.circlesSession = { id: 'stub-session' };
    window.AppState.circlesPhase = 4;
    window.AppState.circlesFinalReport = {
      grade: 'B',
      overallScore: 72,
      headline: '不錯',
      strengths: ['結構清楚'],
      improvements: ['補上量化'],
      coachVerdict: '繼續練。',
      nextSteps: '練習第 8 題',
    };
    window.AppState.circlesStepScores = {
      C1: { totalScore: 70 }, I: { totalScore: 65 }, R: { totalScore: 60 },
      C2: { totalScore: 70 }, L: { totalScore: 75 }, E: { totalScore: 70 }, S: { totalScore: 80 },
    };
    window.AppState.view = 'circles';
    window.render();
  });
  await page.waitForSelector('.circles-submit-bar', { timeout: 5000 });
}

// ── M-019 — Step S sub-tabs ─────────────────────────────────────────────────
test.describe('CLUSTER-A5 — M-019 Step-S sub-tabs', () => {
  test('M-019 [P1] mobile Step-S exposes .s-step-tabs (no desktop gate)', async ({ page }, testInfo) => {
    only(testInfo, PHONE);
    await gotoStepS(page);
    const tabs = page.locator('.s-step-tabs');
    await expect(tabs).toHaveCount(1);
    await expect(page.locator('.s-step-tab')).toHaveCount(2);
  });

  test('M-019 [P1] desktop Step-S exposes .s-step-tabs', async ({ page }, testInfo) => {
    only(testInfo, WIDE);
    await gotoStepS(page);
    const tabs = page.locator('.s-step-tabs');
    await expect(tabs).toHaveCount(1);
    await expect(page.locator('.s-step-tab')).toHaveCount(2);
  });

  test('M-019 [P1] clicking S-2 sub-tab updates active state', async ({ page }, testInfo) => {
    only(testInfo, PHONE);
    await gotoStepS(page);
    await page.locator('.s-step-tab[data-s-step="2"]').click();
    // After re-render, S-2 must be active and S-1 must not be
    await expect(page.locator('.s-step-tab[data-s-step="2"]')).toHaveClass(/active/);
    await expect(page.locator('.s-step-tab[data-s-step="1"]')).not.toHaveClass(/active/);
  });
});

// ── M-020 — Phase-4 PNG export button ───────────────────────────────────────
test.describe('CLUSTER-A5 — M-020 Phase-4 PNG export', () => {
  test('M-020 [P1] mobile final report has #btn-export-png inside submit bar', async ({ page }, testInfo) => {
    only(testInfo, PHONE);
    await gotoFinalReport(page);
    const btn = page.locator('.circles-submit-bar #btn-export-png');
    await expect(btn).toHaveCount(1);
    await expect(btn).toBeVisible();
  });

  test('M-020 [P1] desktop final report has #btn-export-png inside submit bar', async ({ page }, testInfo) => {
    only(testInfo, WIDE);
    await gotoFinalReport(page);
    const btn = page.locator('.circles-submit-bar #btn-export-png');
    await expect(btn).toHaveCount(1);
    await expect(btn).toBeVisible();
  });

  test('M-020 [P1] clicking #btn-export-png does not throw a pageerror', async ({ page }, testInfo) => {
    only(testInfo, WIDE);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await gotoFinalReport(page);
    // Block the html2canvas CDN to force the catch path; handler must swallow.
    await page.route('**/esm.sh/html2canvas**', route => route.abort());
    await page.locator('#btn-export-png').click();
    await page.waitForTimeout(800);
    expect(errors.filter(e => !/html2canvas|esm\.sh/i.test(e))).toEqual([]);
  });
});
