// tests/e2e/circles-phase3-restore.spec.js
// Stage 1B B3 — Phase 3 restore E2E specs.
// Spec ref: 2026-05-16-stage-1b §6 B3-E1..E3 + §7 B3-AC5.
//
// Strategy: boot SPA in clean state, stub GET list endpoints (same pattern as
// circles-gate.spec.js bootToPhase1Drill), then page.evaluate to inject AppState
// mirroring what restoreCirclesPhase1FromSession + B3 fix does, then force
// circlesPhase=3 + render() to land on Phase 3. Assert score UI vs spinner via
// web-first auto-retry — never waitForTimeout.
//
// B3 fix (app.js:7945-7952): restoreCirclesPhase1FromSession derives
// circlesScoreResult from step_scores so Phase 3 renders score UI (not spinner).
//
// Skill ref: playwright-skill/core/assertions-and-waiting.md

const { test } = require('../fixtures/auto-cleanup.fixture');
const { expect } = require('@playwright/test');

// SELECTORS — derived from app.js DOM grep (Step 1):
//   Score UI: data-view="circles" data-phase="3" contains .score-total
//   Loading spinner: .loading-wrap  (contains .loading-spinner + .loading-checklist)
const SELECTORS = {
  // Score UI: unique to renderPhase3Score — score-total only exists in score view
  scoreTotal: '.score-total',
  // Loading wrap: unique to renderPhase3Loading
  loadingWrap: '.loading-wrap',
};

// ── Boot helper ───────────────────────────────────────────────────────────────
// Mirrors bootToPhase1Drill from circles-gate.spec.js:
// Clear LS + stub GET list endpoints → wait for app boot (mode-selector).
async function bootCirclesEmpty(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });

  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/circles-sessions*', stubGet);
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/nsm-sessions*', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions*', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions*', stubGet);

  await page.goto('/');

  // Wait until mode-selector visible = app booted + tryResume settled.
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
}

// ── AppState injection helper ─────────────────────────────────────────────────
// Mirrors what restoreCirclesPhase1FromSession does, including the B3 fix that
// derives circlesScoreResult from step_scores.  Then navigates to Phase 3.
async function injectRestoredSessionAndGoPhase3(page, { mode, drillStep, simStepIndex, stepScores }) {
  await page.evaluate(({ mode, drillStep, simStepIndex, stepScores }) => {
    const A = window.AppState;
    if (!A) return;

    // Mirror restoreCirclesPhase1FromSession fields
    A.circlesMode = (mode === 'simulation') ? 'sim' : 'drill';
    A.circlesDrillStep = drillStep || 'C1';
    A.circlesSimStep = simStepIndex || 0;
    A.circlesStepScores = stepScores || {};
    A.circlesSession = { id: 'e2e-b3-restore' };
    A.circlesSelectedQuestion = (window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS[0]) || { id: 'q-e2e', body: 'E2E 題目' };
    A.circlesConversation = [];
    A.circlesFrameworkDraft = {};
    A.circlesGateResult = null;
    A.circlesPhase3Error = null;
    A.circlesPhase3LoadingStep = 0;
    A.circlesPhase3LoadingSlow = false;
    A.circlesPhase3DimExpanded = {};
    A.circlesPhase3CoachDemoOpen = false;
    A._phase3CoachDemoInitialized = false;

    // Stage 1B B3 fix: derive circlesScoreResult from step_scores
    // (mirrors app.js:7948-7952)
    const stepKey = (A.circlesMode === 'drill')
      ? (A.circlesDrillStep || 'C1')
      : (['C1', 'I', 'R', 'C2', 'L', 'E', 'S'][A.circlesSimStep || 0] || 'C1');
    const scoreRow = (A.circlesStepScores && A.circlesStepScores[stepKey]) || null;
    A.circlesScoreResult = (scoreRow && scoreRow.totalScore != null) ? scoreRow : null;

    // Navigate directly to Phase 3
    A.circlesPhase = 3;
    A.view = 'circles';
    window.render && window.render();
  }, { mode, drillStep, simStepIndex, stepScores });
}

// ── Specs ─────────────────────────────────────────────────────────────────────

test.describe('Stage 1B B3 — Phase 3 restore renders score UI', () => {

  test('B3-E1: drill C1 with step_scores.C1.totalScore present → Phase 3 renders score UI (not spinner)', async ({ page }) => {
    // Boot + stub
    await bootCirclesEmpty(page);

    // Inject: completed C1 drill session with score in step_scores (B3 fix path)
    await injectRestoredSessionAndGoPhase3(page, {
      mode: 'drill',
      drillStep: 'C1',
      simStepIndex: 0,
      stepScores: {
        C1: {
          totalScore: 78,
          dimensions: [
            { name: '問題澄清', score: 4, comment: '清楚' },
            { name: '情境定義', score: 3, comment: '尚可' },
          ],
          strengths: '問題定義清晰',
          improvements: '可加強情境限制說明',
        },
      },
    });

    // Web-first auto-retry: score-total visible (B3 fix → circlesScoreResult set)
    await expect(page.locator(SELECTORS.scoreTotal)).toBeVisible({ timeout: 10_000 });

    // Loading wrap must NOT be visible (spinner gone)
    await expect(page.locator(SELECTORS.loadingWrap)).not.toBeVisible();
  });

  test('B3-E2: empty step_scores → Phase 3 renders loading spinner (regression guard — no over-fix)', async ({ page }) => {
    // Boot + stub
    await bootCirclesEmpty(page);

    // Inject: session with NO step_scores (incomplete session) — B3 fix must NOT
    // fabricate a score result; Phase 3 should spin (correct behavior).
    await injectRestoredSessionAndGoPhase3(page, {
      mode: 'drill',
      drillStep: 'C1',
      simStepIndex: 0,
      stepScores: {},
    });

    // Loading wrap MUST be visible (circlesScoreResult is null → renderPhase3Loading)
    await expect(page.locator(SELECTORS.loadingWrap)).toBeVisible({ timeout: 5_000 });

    // Score-total must NOT be present (no score to display)
    await expect(page.locator(SELECTORS.scoreTotal)).not.toBeVisible();
  });

  test('B3-E3: sim session, sim_step_index=6 (S slot), step_scores.S present → score UI visible', async ({ page }) => {
    // Boot + stub
    await bootCirclesEmpty(page);

    // Inject: completed simulation session at S slot (index 6) with score
    await injectRestoredSessionAndGoPhase3(page, {
      mode: 'simulation',
      drillStep: null,
      simStepIndex: 6,
      stepScores: {
        S: {
          totalScore: 85,
          dimensions: [
            { name: 'NSM 定義', score: 5, comment: '優秀' },
          ],
          strengths: 'NSM 定義精準',
          improvements: '可再強化業務影響說明',
        },
      },
    });

    // Web-first auto-retry: score UI visible
    await expect(page.locator(SELECTORS.scoreTotal)).toBeVisible({ timeout: 10_000 });

    // Spinner NOT visible
    await expect(page.locator(SELECTORS.loadingWrap)).not.toBeVisible();
  });

});
