// @ts-check
// tests/visual/error-wrap-refactor-capture.spec.js
// Capture 5 error-wrap surfaces × 3 viewports = 15 PNGs for cold-Read review of
// Wave 1.5 error-wrap structural refactor (2026-05-22).
//
// Surface map (refactor — renderErrorWrap helper):
//   1. Phase 4 error (line 537, ph-fill div-wrapped icon, <code>, actions)
//   2. NSM gate error (line ~1411, inline ph icon, <code>, actions)
//   3. NSM eval error (line ~1631, inline ph icon, <code>, NO actions)
//   4. CIRCLES Phase 1.5 gate error (line ~5336, inline ph icon, <div> code, actions)
//   5. Phase 3 error (line ~6610, ph-fill div-wrapped icon, <code>, actions with disabled-retry IIFE)

const { test, expect } = require('@playwright/test');

const OUT_DIR = 'audit/error-wrap-refactor-2026-05-22';

async function bootBase(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });
  // Stub all CRUD on session APIs to prevent fake-UUID errors hitting DB
  const stubAll = (route) => {
    const method = route.request().method();
    if (method === 'GET')  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (method === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"00000000-0000-0000-0000-000000000000"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  };
  await page.route('**/api/circles-sessions',       stubAll);
  await page.route('**/api/circles-sessions/**',    stubAll);
  await page.route('**/api/nsm-sessions',           stubAll);
  await page.route('**/api/nsm-sessions/**',        stubAll);
  await page.route('**/api/guest-circles-sessions', stubAll);
  await page.route('**/api/guest-circles-sessions/**', stubAll);
  await page.route('**/api/guest/nsm-sessions',     stubAll);
  await page.route('**/api/guest/nsm-sessions/**',  stubAll);
  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  // Keep stubs in place — we don't want any POST to hit DB during capture.
}

async function enterPhase4Error(page) {
  await bootBase(page);
  await page.evaluate(() => {
    const A = window.AppState;
    A.circlesSelectedQuestion = window.CIRCLES_QUESTIONS[0];
    A.circlesMode             = 'drill';
    A.circlesPhase            = 4;
    A.circlesSession          = { id: '00000000-0000-0000-0000-000000000001' };
    A.circlesPhase4Error      = { code: 'REPORT_API_ERROR', message: '報告 API 錯誤' };
    A.view                    = 'circles';
    window.render();
  });
  await page.locator('[data-view="circles"][data-phase="4"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function enterNSMGateError(page) {
  await bootBase(page);
  await page.evaluate(() => {
    const A = window.AppState;
    A.nsmStep      = 2;
    A.nsmSubTab    = 'nsm-gate';
    A.nsmGateError = 'GATE_API_ERROR';
    A.nsmGateResult = null;
    A.nsmGateLoading = false;
    A.nsmDefinition = { nsm: 'test NSM' };
    A.view         = 'nsm';
    window.render();
  });
  await page.locator('[data-view="nsm"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function enterNSMEvalError(page) {
  await bootBase(page);
  await page.evaluate(() => {
    const A = window.AppState;
    A.nsmStep       = 3;
    A.nsmEvalError  = 'EVAL_RATE_LIMIT';
    A.nsmEvalResult = null;
    A.view          = 'nsm';
    window.render();
  });
  await page.locator('[data-view="nsm"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function enterCirclesGateError(page) {
  await bootBase(page);
  await page.evaluate(() => {
    const A = window.AppState;
    A.circlesSelectedQuestion = window.CIRCLES_QUESTIONS[0];
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 1.5;
    A.circlesSession          = { id: '00000000-0000-0000-0000-000000000002' };
    A.circlesGateError        = 'GATE_API_ERROR';
    A.circlesGateResult       = null;
    A.circlesGateLoading      = false;
    A.gateInflight            = false;
    A.view                    = 'circles';
    window.render();
  });
  await page.locator('[data-view="circles"][data-circles-phase="1.5"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function enterPhase3Error(page) {
  await bootBase(page);
  await page.evaluate(() => {
    const A = window.AppState;
    A.circlesSelectedQuestion = window.CIRCLES_QUESTIONS[0];
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 3;
    A.circlesSession          = { id: '00000000-0000-0000-0000-000000000003' };
    A.circlesPhase3Error      = 'EVAL_API_ERROR';
    A.circlesScoreResult      = null;
    A.view                    = 'circles';
    window.render();
  });
  await page.locator('[data-view="circles"][data-phase="3"]').waitFor({ state: 'visible', timeout: 10_000 });
}

const SURFACES = [
  { id: '01-phase4-err',  label: 'Phase 4 error (mockup 13, ph-fill div + <code>)',          enter: enterPhase4Error },
  { id: '02-nsm-gate-err', label: 'NSM gate error (inline ph + <code>)',                    enter: enterNSMGateError },
  { id: '03-nsm-eval-err', label: 'NSM eval error (inline ph + <code>, no actions)',        enter: enterNSMEvalError },
  { id: '04-circles-gate-err', label: 'CIRCLES gate error (inline ph + <div> code)',        enter: enterCirclesGateError },
  { id: '05-phase3-err', label: 'Phase 3 error (mockup 11, ph-fill div + <code>)',          enter: enterPhase3Error },
];

for (const s of SURFACES) {
  test(`${s.id} — ${s.label}`, async ({ page }, testInfo) => {
    await s.enter(page);
    await page.waitForTimeout(300);
    const fileName = `${s.id}-${testInfo.project.name}.png`;
    await page.screenshot({ path: `${OUT_DIR}/${fileName}`, fullPage: true });
    const errWrap = page.locator('.error-wrap').first();
    await expect(errWrap).toBeVisible({ timeout: 5_000 });
  });
}
