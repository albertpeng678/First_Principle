// @ts-check
// tests/visual/qchip-refactor-capture.spec.js
// Capture 6 qchip surface × N viewports (via tests/visual/playwright.config.js
// projects). Used for cold-Read review of Wave 1.5 qchip structural refactor
// (2026-05-21).
//
// Surface map (refactor — renderQchipShell helper):
//   1. Phase 2 chat (line 822, ph-bookmark-simple, button wrapper)
//   2. Phase 1 L step sol-multi (line 4665, ph-info, sim simStep=4)
//   3. Phase 1 E step sol-multi (line 4775, ph-info, sim simStep=5)
//   4. Phase 1 S step multi-input (line 4944, ph-info, sim simStep=6)
//   5. Phase 1.5 gate result (line 5126, ph-bookmark-simple, short+long)
//   6. Phase 1 drill modifier (line 5448, ph-info, drill mode)

const { test, expect } = require('@playwright/test');

const OUT_DIR = 'audit/qchip-refactor-2026-05-21';

async function bootBase(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions',           stubGet);
  await page.route('**/api/nsm-sessions',               stubGet);
  await page.route('**/api/guest-circles-sessions',     stubGet);
  await page.route('**/api/guest/nsm-sessions',         stubGet);
  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

async function enterPhase2Chat(page) {
  await bootBase(page);
  await page.evaluate(() => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[0];
    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 2;
    A.circlesSession          = { id: 'capture-phase2-synth' };
    A.circlesConversation     = [
      { role: 'coach', text: '請描述你的目標用戶群體。', hint: null, example: null },
    ];
    A.circlesStepScores            = {};
    A.circlesPhase2ConclusionMode  = false;
    A.circlesPhase2Streaming       = false;
    A.circlesPhase2StreamError     = false;
    A.view                         = 'circles';
    window.render();
  });
  await page.locator('[data-view="circles"][data-phase="2"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function enterPhase1Sim(page, simStepIdx) {
  await bootBase(page);
  await page.evaluate((idx) => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[0];
    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'simulation';
    A.circlesPhase            = 1;
    A.circlesSimStep          = idx;
    A.circlesSession          = { id: 'capture-phase1-sim-synth' };
    A.circlesFrameworkDraft   = {};
    A.circlesChipExpanded     = false;
    A.view                    = 'circles';
    window.render();
  }, simStepIdx);
  await page.locator('[data-view="circles"][data-circles-phase="1"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function enterPhase1Drill(page) {
  await bootBase(page);
  await page.evaluate(() => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[0];
    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 1;
    A.circlesSession          = { id: 'capture-phase1-drill-synth' };
    A.circlesFrameworkDraft   = {};
    A.circlesChipExpanded     = false;
    A.view                    = 'circles';
    window.render();
  });
  await page.locator('[data-view="circles"][data-circles-phase="1"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function enterPhase15Gate(page) {
  await bootBase(page);
  await page.evaluate(() => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[0];
    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 1.5;
    A.circlesSession          = { id: 'capture-phase15-synth' };
    A.circlesGateResult       = {
      overallStatus: 'error',
      items: [
        { field: '用戶', status: 'ok',    title: '用戶群體清晰', reason: '20-35 歲女性符合條件' },
        { field: '場景', status: 'warn',  title: '場景可更具體', reason: '可補上下班場景', suggestion: '加上「通勤時段」' },
        { field: '痛點', status: 'error', title: '痛點需更聚焦', reason: '建議聚焦在 1 個主要痛點', suggestion: '改成「下班通勤時無法專注追劇」' },
      ],
    };
    A.circlesGateLoading      = false;
    A.gateInflight            = false;
    A.circlesLocked           = false;
    A.circlesChipExpanded     = false;
    A.view                    = 'circles';
    window.render();
  });
  await page.locator('[data-view="circles"][data-circles-phase="1.5"]').waitFor({ state: 'visible', timeout: 10_000 });
}

const SURFACES = [
  { id: '01-phase2-chat',  label: 'Phase 2 chat (mockup 05, ph-bookmark-simple, button)',                  enter: enterPhase2Chat },
  { id: '02-phase1-Lstep', label: 'Phase 1 L step sol-multi (mockup 03, ph-info)',                         enter: (p) => enterPhase1Sim(p, 4) },
  { id: '03-phase1-Estep', label: 'Phase 1 E step sol-multi (mockup 03, ph-info)',                         enter: (p) => enterPhase1Sim(p, 5) },
  { id: '04-phase1-Sstep', label: 'Phase 1 S step multi-input (mockup 03, ph-info)',                       enter: (p) => enterPhase1Sim(p, 6) },
  { id: '05-phase15-gate', label: 'Phase 1.5 gate result (mockup 04, ph-bookmark-simple, short+long)',     enter: enterPhase15Gate },
  { id: '06-phase1-drill', label: 'Phase 1 drill C1 modifier (mockup 03, ph-info, drill)',                 enter: enterPhase1Drill },
];

for (const s of SURFACES) {
  test(`${s.id} — ${s.label}`, async ({ page }, testInfo) => {
    await s.enter(page);
    await page.waitForTimeout(300);
    const fileName = `${s.id}-${testInfo.project.name}.png`;
    await page.screenshot({ path: `${OUT_DIR}/${fileName}`, fullPage: true });
    const qchip = page.locator('.qchip').first();
    await expect(qchip).toBeVisible({ timeout: 5_000 });
  });
}
