// tests/e2e/circles-back-nav-lock.spec.js
// AC-5 (spec b2ca935): 5 TC integration test for back-nav lock + qchip 4-block.
//
// Skills applied (cited verbatim per STANDING feedback_playwright_skill_cited_application):
//   - playwright-skill/core/auth-flows.md:928-949  "Login via API for Speed"
//       → auth.setup.js (storageState) handles browser session; in-page apiFetch
//       reads AppState.accessToken (set from Supabase getSession on boot).
//   - playwright-skill/core/common-pitfalls.md Pitfall 11 "Over-Mocking (Mocking Your Own API)"
//       → ZERO route.fulfill on /api/circles-sessions/**; the boot stub returns []
//       for empty list endpoints only and is un-routed immediately. step_scores are
//       seeded directly to Supabase via service-role (per api-testing.md 783-848
//       "API Data Seeding" carve-out: writing fixture data to real DB ≠ mocking app API).
//   - playwright-skill/core/common-pitfalls.md Pitfall 19 "Not Using test.step() for Complex Flows"
//       → every TC wraps phases in test.step() for trace structure + report clarity.
//   - playwright-skill/core/common-pitfalls.md Pitfall 3 "Using CSS Selectors Instead of Role-Based Locators"
//       → used hasText/role-style locators where natural; CSS selectors used for
//       structural targets (data-phase attrs, .qchip-ana__block) per code design.
//   - playwright-skill/core/network-mocking.md:839-933 "Network Error Simulation"
//       → route.fulfill IS allowed for external services or — as here — the bootApp
//       stub of empty list endpoints during initial page load. Same pattern as
//       circles-phase3-restore-real.spec.js bootApp.
//
// Real OpenAI is NEVER called: step_scores seeded via Supabase service-role
// (legitimate data seeding) so each TC runs in ~5-15 s (vs 30-60 s for real OpenAI).
//
// Cleanup: in-page apiFetch DELETE (uses AppState.accessToken Bearer auth).
// Mirrors circles-phase3-restore-real.spec.js best-effort pattern.

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const { test, expect } = require('@playwright/test');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Isolation strategy (eliminates flake from shared backend state):
//   1. Per-project question_id → no cross-project collision (e2e@first-principle.test
//      is the same user across all 3 e2e projects, so we must vary another key field).
//   2. Per-TC drill_step → no within-project worker collision (draft endpoint is
//      idempotent on (user, question_id, mode, drill_step, status='active')).
// Together: every test owns its own DB row, even across parallel projects + workers.
// CIRCLES has 100 questions; we reserve circles_011/012/013 (one per project).
const QUESTION_BY_PROJECT = {
  'e2e-desktop':       'circles_011',
  'e2e-mobile-chrome': 'circles_012',
  'e2e-mobile-safari': 'circles_013',
};
function questionForTest(testInfo) {
  return QUESTION_BY_PROJECT[testInfo.project.name] || 'circles_011';
}

// Per-TC drill_step (within a project) — must be one of the 7 canonical CIRCLES
// steps so renderCirclesPhase1 picks valid step config (otherwise falls back to C1).
const STEP = {
  TC1: 'C1',  // scored → lock-on-back
  TC2: 'I',   // scored → 422 guard
  TC3: 'R',   // scored → retry disabled
  TC4: 'C2',  // unscored → qchip 4-block (active variant)
  TC5_SCORED: 'L',
  TC5_UNSCORED: 'E',
};

// ── Selectors (verified against app.js renderers) ───────────────────────────
const SEL = {
  modeSelector: '[data-circles-mode="drill"]',
  // Phase 1 uses data-circles-phase="1" (renderCirclesPhase1 line 5154)
  phase1Root: '[data-view="circles"][data-circles-phase="1"]',
  rtFieldLocked: '.rt-field--locked',
  viewScoreBtn: '[data-phase1="view-score"]',
  submitBtn: '[data-phase1="submit"]',
  hintBtn: '[data-phase1="hint"]',
  exampleToggleBtn: '[data-phase1="example-toggle"]',
  // Phase 2 uses data-phase="2" (renderCirclesPhase2 line 907 / Locked line 1114)
  phase2Root: '[data-view="circles"][data-phase="2"]',
  goPhase1Btn: '[data-phase2="go-phase1"]',
  goPhase3Btn: '[data-phase2="go-phase3"]',
  qchipBtn: '[data-phase2="qchip"]',
  qchipExpand: '.qchip-expand',
  qchipAnaBlock: '.qchip-ana__block',
  // Phase 3 uses data-phase="3" (renderPhase3Error line 6266 — where retry lives)
  phase3Root: '[data-view="circles"][data-phase="3"]',
  retryBtn: '[data-phase3="retry"]',
};

// ── bootApp: stub empty list endpoints, navigate, wait for boot ─────────────
// Pitfall 11 carve-out: stubbing GET list (returns [] on app boot) is identical
// to circles-phase3-restore-real.spec.js bootApp. Un-routed immediately after.
async function bootApp(page) {
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
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);

  await page.goto('/');
  await page.locator(SEL.modeSelector).waitFor({ state: 'visible', timeout: 15_000 });

  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// ── waitForAuth: wait until AppState.accessToken populated (Supabase ready) ─
async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

// ── createDraftSession: in-page apiFetch (real auth via AppState.accessToken)
async function createDraftSession(page, opts) {
  const { questionId, drillStep } = opts;

  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  const sessionId = await page.evaluate(async ({ qid, step }) => {
    const A = window.AppState;
    const isAuth = !!A.accessToken;
    const path = isAuth ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: qid, mode: 'drill', drill_step: step }),
    });
    if (!res.ok) {
      throw new Error('createDraftSession: status ' + res.status);
    }
    const session = await res.json();
    A.circlesSession = session;
    return session.id;
  }, { qid: questionId, step: drillStep });

  expect(sessionId).toBeTruthy();
  return sessionId;
}

// ── seedStepScores: Supabase REST PATCH (data seeding, not own-API mock) ──
async function seedStepScores(pageRequest, sessionId, stepScores) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('seedStepScores: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
  }
  const url = `${SUPABASE_URL}/rest/v1/circles_sessions?id=eq.${sessionId}`;
  const res = await pageRequest.patch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    data: { step_scores: stepScores },
  });
  const status = res.status();
  if (status !== 204 && status !== 200) {
    const body = await res.text();
    throw new Error(`seedStepScores: Supabase PATCH returned ${status}. Body: ${body}`);
  }
}

// ── seedLifecycleGated: set lifecycle='gated' via Supabase REST (data seeding) ──
// L5 fix (P0-#255): /evaluate-step now requires lifecycle='gated' or 'completed'.
// Seed via service-role to bypass /gate for tests that are NOT testing the lifecycle guard.
async function seedLifecycleGated(pageRequest, sessionId) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('seedLifecycleGated: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
  }
  const url = `${SUPABASE_URL}/rest/v1/circles_sessions?id=eq.${sessionId}`;
  const res = await pageRequest.patch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    data: { lifecycle: 'gated' },
  });
  const status = res.status();
  if (status !== 204 && status !== 200) {
    const body = await res.text();
    throw new Error(`seedLifecycleGated: Supabase PATCH returned ${status}. Body: ${body}`);
  }
}

// ── triggerRealRestore: real GET via window._loadCirclesSessionItem ─────────
async function triggerRealRestore(page, sessionId, drillStep) {
  await page.waitForFunction(
    () => typeof window._loadCirclesSessionItem === 'function',
    { timeout: 10_000 }
  );

  // Clear circlesSession to bypass dedup guard.
  await page.evaluate(() => {
    const A = window.AppState;
    A.circlesSession = null;
    A.circlesPhase = 0;
  });

  await page.evaluate(async ({ sid, step }) => {
    await window._loadCirclesSessionItem({ id: sid, mode: 'drill', drill_step: step });
  }, { sid: sessionId, step: drillStep });

  await page.waitForFunction(
    (sid) => {
      const A = window.AppState;
      return A && A.view === 'circles' && A.circlesPhase === 1
        && A.circlesSession && String(A.circlesSession.id) === String(sid);
    },
    sessionId,
    { timeout: 15_000 }
  );
}

// ── Canonical step-score fixture (EvaluatorResponse §1.4 shape) ─────────────
function fixtureStepScore() {
  return {
    totalScore: 78,
    dimensions: [
      { name: '問題澄清', score: 4, comment: 'E2E fixture' },
      { name: '情境定義', score: 3, comment: 'E2E fixture' },
    ],
    highlight: 'E2E fixture highlight',
    improvement: 'E2E fixture improvement',
    coachVersion: { context: 'E2E ctx', perField: [], reasoning: 'E2E reasoning' },
  };
}

// ── Cleanup: in-page apiFetch DELETE (best-effort, Bearer auth via AppState) ─
async function cleanupSession(page, sessionId) {
  try {
    await page.evaluate(async (sid) => {
      const A = window.AppState;
      if (!A || !A.accessToken) return;
      try {
        await window.apiFetch('/api/circles-sessions/' + sid, { method: 'DELETE' });
      } catch (_) { /* best-effort */ }
    }, sessionId);
  } catch (_) { /* best-effort */ }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
test.describe('CIRCLES back-nav lock + qchip 4-block — AC-5 (spec b2ca935)', () => {

  // ── TC1 — lock-on-back: Phase 2 → Phase 1 locked (AC-3, validates commit d8e4814) ──
  test('TC1: 上一步 from scored Phase 2 → Phase 1 locked (readonly + view-score btn + hint/example clickable)', async ({ page }, testInfo) => {
    // T5 cleanup: test.slow() removed — observed runtime 2-3 s per TC, default
    // 90 s timeout (playwright.config.js:20) is more than sufficient. Triple-
    // ing to 270 s only masked the auth.setup.js race (fixed in same commit).
    let sessionId;

    try {
      await test.step('boot app + wait for auth', async () => {
        await bootApp(page);
        await waitForAuth(page);
      });

      await test.step(`seed draft session (drill ${STEP.TC1})`, async () => {
        sessionId = await createDraftSession(page, { questionId: questionForTest(testInfo), drillStep: STEP.TC1 });
      });

      await test.step('inject step_scores via Supabase REST (data seeding, not own-API mock)', async () => {
        await seedStepScores(page.request, sessionId, { [STEP.TC1]: fixtureStepScore() });
      });

      await test.step('trigger real restore via window._loadCirclesSessionItem', async () => {
        await triggerRealRestore(page, sessionId, STEP.TC1);
      });

      await test.step('verify circlesLocked=true and circlesStepScores hydrated', async () => {
        const state = await page.evaluate((step) => ({
          locked: window.AppState.circlesLocked,
          scoresKey: window.AppState.circlesStepScores && window.AppState.circlesStepScores[step] ? window.AppState.circlesStepScores[step].totalScore : null,
        }), STEP.TC1);
        expect(state.locked).toBe(true);
        expect(state.scoresKey).toBe(78);
      });

      await test.step(`navigate to Phase 2 (renders LOCKED variant since ${STEP.TC1} scored)`, async () => {
        await page.evaluate(() => {
          window.AppState.circlesPhase = 2;
          window.render && window.render();
        });
        await expect(page.locator(SEL.phase2Root)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator(SEL.goPhase1Btn)).toBeVisible();
      });

      await test.step('click 上一步（看框架） → return to Phase 1 (locked)', async () => {
        await page.locator(SEL.goPhase1Btn).click();
        await expect(page.locator(SEL.phase1Root)).toBeVisible({ timeout: 10_000 });
      });

      await test.step('Phase 1 form is locked: rt-field--locked + view-score btn + no editable submit', async () => {
        await expect(page.locator(SEL.rtFieldLocked).first()).toBeVisible();
        // submit btn replaced with view-score per applyPhase1StateOverlay:3580-3582
        await expect(page.locator(SEL.viewScoreBtn)).toBeVisible();
        await expect(page.locator(SEL.submitBtn)).toHaveCount(0);
      });

      await test.step('hint + example buttons remain rendered (STANDING memory lock_state_hint_example_always_available)', async () => {
        await expect(page.locator(SEL.hintBtn).first()).toBeVisible();
        await expect(page.locator(SEL.exampleToggleBtn).first()).toBeVisible();

        // Task 6 (spec b2ca935 §11.1) — visual regression baseline for Phase 1 locked state.
        await expect(page.locator(SEL.phase1Root)).toHaveScreenshot(
          `phase1-locked-from-back-${testInfo.project.name}.png`,
          { maxDiffPixelRatio: 0.005 }
        );
      });
    } finally {
      if (sessionId) await cleanupSession(page, sessionId);
    }
  });

  // ── TC2 — BE 422 reject re-score (AC-2, validates commit d930159) ──────────
  test('TC2: POST /evaluate-step on already-scored step → 422 step_already_scored', async ({ page }, testInfo) => {
    // T5 cleanup: test.slow() removed — observed runtime 2-3 s per TC, default
    // 90 s timeout (playwright.config.js:20) is more than sufficient. Triple-
    // ing to 270 s only masked the auth.setup.js race (fixed in same commit).
    let sessionId;

    try {
      await test.step('boot + auth + draft', async () => {
        await bootApp(page);
        await waitForAuth(page);
        sessionId = await createDraftSession(page, { questionId: questionForTest(testInfo), drillStep: STEP.TC2 });
      });

      await test.step(`seed step_scores[${STEP.TC2}] + lifecycle='gated' via Supabase REST`, async () => {
        // L5 fix (P0-#255): lifecycle='gated' required for /evaluate-step. Seed both
        // step_scores and lifecycle so we reach the 422 step_already_scored guard.
        await seedStepScores(page.request, sessionId, { [STEP.TC2]: fixtureStepScore() });
        await seedLifecycleGated(page.request, sessionId);
      });

      await test.step('in-page apiFetch POST /evaluate-step → expect 422 step_already_scored', async () => {
        // apiFetch uses AppState.accessToken Bearer auth (same as real user clicks).
        // Hits real backend route at routes/circles-sessions.js:253 guard.
        const result = await page.evaluate(async ({ sid, step }) => {
          const res = await window.apiFetch('/api/circles-sessions/' + sid + '/evaluate-step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stepKey: step,
              framework: { '問題範圍': 'retry attempt' },
              conversation: [],
            }),
          });
          let body = null;
          try { body = await res.json(); } catch (_) {}
          return { status: res.status, body };
        }, { sid: sessionId, step: STEP.TC2 });

        expect(result.status).toBe(422);
        expect(result.body).toBeTruthy();
        expect(result.body.error).toBe('step_already_scored');
        expect(result.body.stepKey).toBe(STEP.TC2);
      });
    } finally {
      if (sessionId) await cleanupSession(page, sessionId);
    }
  });

  // ── TC3 — Phase 3 retry button disabled (AC-4, validates commit 3a61489) ───
  test('TC3: Phase 3 retry button disabled when step scored (error variant)', async ({ page }, testInfo) => {
    // T5 cleanup: test.slow() removed — observed runtime 2-3 s per TC, default
    // 90 s timeout (playwright.config.js:20) is more than sufficient. Triple-
    // ing to 270 s only masked the auth.setup.js race (fixed in same commit).
    let sessionId;

    try {
      await test.step('boot + auth + draft', async () => {
        await bootApp(page);
        await waitForAuth(page);
        sessionId = await createDraftSession(page, { questionId: questionForTest(testInfo), drillStep: STEP.TC3 });
      });

      await test.step(`seed step_scores[${STEP.TC3}] via Supabase REST`, async () => {
        await seedStepScores(page.request, sessionId, { [STEP.TC3]: fixtureStepScore() });
      });

      await test.step('restore + force Phase 3 error variant (retry btn only in renderPhase3Error)', async () => {
        await triggerRealRestore(page, sessionId, STEP.TC3);
        // Force error state so renderPhase3Error path is taken (line 6266 in app.js).
        // renderPhase3Score has no retry btn — so AC-4's guard is testable only here.
        await page.evaluate(() => {
          const A = window.AppState;
          A.circlesPhase = 3;
          A.circlesPhase3Error = { code: 'EVAL_TIMEOUT', message: 'forced for retry-disable test' };
          window.render && window.render();
        });
        await expect(page.locator(SEL.phase3Root)).toBeVisible({ timeout: 10_000 });
      });

      await test.step('retry button disabled + aria-disabled="true"', async () => {
        const retryBtn = page.locator(SEL.retryBtn);
        await expect(retryBtn).toBeVisible();
        await expect(retryBtn).toBeDisabled();
        await expect(retryBtn).toHaveAttribute('aria-disabled', 'true');
      });
    } finally {
      if (sessionId) await cleanupSession(page, sessionId);
    }
  });

  // ── TC4 — qchip 4-block content (AC-1, validates commit 49d00ba) ───────────
  test('TC4: Phase 2 qchip click → 4 .qchip-ana__block visible with all 4 labels', async ({ page }, testInfo) => {
    // T5 cleanup: test.slow() removed — observed runtime 2-3 s per TC, default
    // 90 s timeout (playwright.config.js:20) is more than sufficient. Triple-
    // ing to 270 s only masked the auth.setup.js race (fixed in same commit).
    let sessionId;

    try {
      await test.step('boot + auth + draft + restore (no scores → active Phase 2)', async () => {
        await bootApp(page);
        await waitForAuth(page);
        sessionId = await createDraftSession(page, { questionId: questionForTest(testInfo), drillStep: STEP.TC4 });
        // No step_scores → renderCirclesPhase2 (active variant). Both variants use
        // renderQchipExpand per Task 4; active path is simpler.
        await triggerRealRestore(page, sessionId, STEP.TC4);
      });

      await test.step('navigate to Phase 2 (active variant)', async () => {
        await page.evaluate(() => {
          window.AppState.circlesPhase = 2;
          window.render && window.render();
        });
        await expect(page.locator(SEL.phase2Root)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator(SEL.qchipBtn)).toBeVisible();
      });

      await test.step('click qchip → expand panel + assert 4 blocks present with labels', async () => {
        // renderQchipExpand starts display:none (forced by Phase 2 bind); click toggles open.
        await page.locator(SEL.qchipBtn).click();
        const expand = page.locator(SEL.qchipExpand);
        await expect(expand).toBeVisible();
        const blocks = expand.locator(SEL.qchipAnaBlock);
        await expect(blocks).toHaveCount(4);
        // Each of 4 block labels must be present (商業背景/用戶輪廓/常見誤區/破題切入).
        const labels = ['商業背景', '用戶輪廓', '常見誤區', '破題切入'];
        for (const label of labels) {
          await expect(expand.locator('.qchip-ana__head', { hasText: label })).toBeVisible();
        }

        // Task 6 (spec b2ca935 §11.1) — visual regression baseline for Phase 2 qchip expanded state.
        await expect(expand).toHaveScreenshot(
          `phase2-qchip-expanded-${testInfo.project.name}.png`,
          { maxDiffPixelRatio: 0.005 }
        );
      });
    } finally {
      if (sessionId) await cleanupSession(page, sessionId);
    }
  });

  // ── TC5 — Cross-step independence (AC-3 边界) ─────────────────────────────
  test(`TC5: ${STEP.TC5_SCORED} scored does NOT lock ${STEP.TC5_UNSCORED} step (separate session per drill step)`, async ({ page }, testInfo) => {
    // T5 cleanup: see note above — default 90 s timeout sufficient.
    let sessionScored, sessionUnscored;

    try {
      await test.step('boot + auth', async () => {
        await bootApp(page);
        await waitForAuth(page);
      });

      await test.step(`create ${STEP.TC5_SCORED} session (scored) + ${STEP.TC5_UNSCORED} session (unscored)`, async () => {
        sessionScored = await createDraftSession(page, { questionId: questionForTest(testInfo), drillStep: STEP.TC5_SCORED });
        await seedStepScores(page.request, sessionScored, { [STEP.TC5_SCORED]: fixtureStepScore() });
        // Different drill_step → distinct row (idempotency keys on q+step).
        sessionUnscored = await createDraftSession(page, { questionId: questionForTest(testInfo), drillStep: STEP.TC5_UNSCORED });
      });

      await test.step(`restore ${STEP.TC5_UNSCORED} session → circlesLocked must be false (no score)`, async () => {
        await triggerRealRestore(page, sessionUnscored, STEP.TC5_UNSCORED);
        const state = await page.evaluate((step) => ({
          locked: window.AppState.circlesLocked,
          drillStep: window.AppState.circlesDrillStep,
          hasScore: !!(window.AppState.circlesStepScores && window.AppState.circlesStepScores[step]),
        }), STEP.TC5_UNSCORED);
        expect(state.drillStep).toBe(STEP.TC5_UNSCORED);
        expect(state.hasScore).toBe(false);
        expect(state.locked).toBe(false);
      });

      await test.step(`Phase 1 ${STEP.TC5_UNSCORED} form editable: submit btn visible, no view-score, no rt-field--locked`, async () => {
        await expect(page.locator(SEL.phase1Root)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator(SEL.submitBtn).first()).toBeVisible();
        await expect(page.locator(SEL.viewScoreBtn)).toHaveCount(0);
        await expect(page.locator(SEL.rtFieldLocked)).toHaveCount(0);
      });
    } finally {
      if (sessionScored) await cleanupSession(page, sessionScored);
      if (sessionUnscored) await cleanupSession(page, sessionUnscored);
    }
  });

});
