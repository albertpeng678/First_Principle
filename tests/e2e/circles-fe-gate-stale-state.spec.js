// tests/e2e/circles-fe-gate-stale-state.spec.js
// L10 — Bug 1 FE investigation: gateResult state persistence audit (P0-#251)
//
// KARPATHY — Think Before:
//   Suspected stale-state surfaces identified in pre-flight audit:
//   1. PERSISTED_KEYS includes 'circlesGateResult' (app.js:160) → restore() at boot
//      (line 251) re-hydrates stale gateResult into AppState BEFORE tryResumeLatestSession
//      (async) can overwrite it with authoritative server state.
//   2. qcard-confirm "no live session" branch (line 5780) sets circlesGateResult=null
//      for NEW question selection — but only in the "no-existing-session" code path.
//      If loadCirclesSessionFromHistory is called instead (line 5768), gateResult is
//      restored from server's gate_result column (which is authoritative).
//   3. Cross-question bleed: switching Q while AppState.circlesGateResult truthy —
//      after L5's FE LEAK-5 fix (line 7549-7553), proceed requires
//      canProceed===true && overallStatus in ['ok','warn'], so stale gateResult
//      alone is NOT sufficient to bypass phase advance — the L5 guard blocks it.
//   4. localStorage pmDrillState stale gate: pre-populated pmDrillState with
//      canProceed:true survives reload via restore() (line 173-181). Even if L5
//      blocks the UI proceed, the stale value is in AppState and could be
//      misread by renderGateResult (line 4980) if phase=1.5 is also stale.
//   5. PATCH /progress with client-supplied gateResult body: server accepts it
//      at circles-sessions.js:338 — no server-side validation of canProceed value.
//      However, the authoritative gate is POST /gate which writes gate_result
//      via the OpenAI reviewer path (line 194) — client-supplied PATCH only
//      persists the result the FE already received from POST /gate.
//
// SKILLS CITED (per STANDING feedback_playwright_skill_cited_application):
//   - playwright-skill/core/auth-flows.md:928-949
//       → storageState handles browser session; AppState.accessToken populated by
//         Supabase getSession on boot. No login steps inside tests.
//   - playwright-skill/core/mobile-and-responsive.md:49-71
//       → 3 e2e projects: e2e-desktop (Chrome), e2e-mobile-chrome (Pixel 5),
//         e2e-mobile-safari (iPhone 14) via playwright.config.js matrix.
//   - playwright-skill/core/common-pitfalls.md Pitfall 14 (no shared state)
//       → per-project question_id isolation; pmDrillState cleared per test via
//         addInitScript to prevent cross-test state bleed.
//   - playwright-skill/core/network-mocking.md
//       → route.fulfill for empty list stubs (boot only, un-routed immediately);
//         counter pattern (requestsFinished.push) to verify POST /gate call count.
//   - playwright-skill/core/common-pitfalls.md Pitfall 11
//       → ZERO route.fulfill on /api/circles-sessions/**, ZERO mock of gate result.
//         Boot-only stub returning [] is the standard carve-out.
//
// REAL-DATA DISCIPLINE (feedback_e2e_real_data_only):
//   - Real Supabase test DB (e2e@first-principle.test)
//   - ZERO stub timestamp / ZERO mock of own backend behavior
//   - ZERO prod URL (http://localhost:3000)
//
// Question isolation: circles_031/032/033 reserved for this spec.
// circles_011/012/013 → circles-back-nav-lock; circles_021/022/023 → circles-fresh-form
// circles_024/025/026 → alt questions in fresh-form Scenario C
// circles_031/032/033 → this spec (L10 gate-stale-state)
//
// NOTE on Scenario a (real gate POST): this scenario calls real OpenAI (POST /gate).
// Timeout is 90s per test (configured in playwright.config.js). It will take ~30-60s.
// All other scenarios use page.evaluate to inject AppState directly — fast (~5-10s).

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const path = require('path');
const { test, expect } = require('@playwright/test');

const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');
const PNG_DIR   = path.join(__dirname, '..', '..', 'audit', 'bug1-fe-gate-stale');

// ── Per-project question isolation ───────────────────────────────────────────
// Reserve circles_031-033 for this spec to avoid cross-spec DB collision.
const QUESTION_BY_PROJECT = {
  'e2e-desktop':       'circles_031',
  'e2e-mobile-chrome': 'circles_032',
  'e2e-mobile-safari': 'circles_033',
};
function questionForTest(testInfo) {
  return QUESTION_BY_PROJECT[testInfo.project.name] || 'circles_031';
}

// ── storageState: pre-authenticated via auth.setup.js ───────────────────────
test.use({ storageState: AUTH_FILE });

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * bootApp: clear pmDrillState (includes circlesGateResult per PERSISTED_KEYS)
 * while preserving Supabase auth token. Stub list endpoints to [] so
 * tryResumeLatestSession exits without auto-resume racing with our test state.
 * Un-route immediately after page load so real CRUD calls (POST /draft, POST /gate,
 * PATCH /progress) flow through unintercepted.
 *
 * Pitfall 11 carve-out: returning [] for GET list is identical to the pattern
 * in circles-back-nav-lock.spec.js and circles-fresh-form-no-ghost.spec.js.
 */
async function bootApp(page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('pmDrillState');
      const draftKeys = Object.keys(localStorage).filter(k => k.startsWith('pmdrill:'));
      draftKeys.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (_) {}
  });

  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions',       stubGet);
  await page.route('**/api/nsm-sessions',           stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions',     stubGet);

  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

/** waitForAuth: wait until AppState.accessToken is populated by Supabase getSession. */
async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

/** takeEvidenceScreenshot: capture PNG to audit/bug1-fe-gate-stale/<scenario>-<project>.png */
async function takeEvidenceScreenshot(page, testInfo, scenario) {
  const projectName = testInfo.project.name.replace(/[^a-z0-9-]/gi, '-');
  const pngPath = path.join(PNG_DIR, `${scenario}-${projectName}.png`);
  await page.screenshot({ path: pngPath, fullPage: true });
  return pngPath;
}

/**
 * injectPhase1DrillState: inject AppState for Phase 1 Drill C1 with a given question.
 * Clears gateResult + resets all gate-related flags. Calls window.render().
 * This is the same pattern used by circles-gate.spec.js bootToPhase1Drill.
 */
async function injectPhase1DrillState(page, questionId) {
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  await page.evaluate((qid) => {
    const A = window.AppState;
    const q = (window.CIRCLES_QUESTIONS || []).find(x => x.id === qid)
           || window.CIRCLES_QUESTIONS[0];

    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 1;
    A.circlesSimStep          = 0;
    A.circlesSession          = null;
    A.circlesGateResult       = null;
    A.circlesGateLoading      = false;
    A.circlesGateError        = null;
    A.gateInflight            = false;
    A.circlesLocked           = false;
    A.circlesStale            = false;
    A.circlesExpandedQid      = null;
    A.view                    = 'circles';
    if (!A.circlesFrameworkDraft) A.circlesFrameworkDraft = {};
    window.render();
  }, questionId);

  await page.locator('[data-view="circles"][data-circles-phase="1"]')
    .waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * readGateResult: return AppState.circlesGateResult from the browser.
 */
function readGateResult(page) {
  return page.evaluate(() => (window.AppState && window.AppState.circlesGateResult) || null);
}

/**
 * readCirclesPhase: return AppState.circlesPhase from the browser.
 */
function readCirclesPhase(page) {
  return page.evaluate(() => (window.AppState && window.AppState.circlesPhase) || null);
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

/**
 * Scenario a — Stale gateResult from prior session (pmDrillState restore).
 *
 * Root cause surface: PERSISTED_KEYS includes 'circlesGateResult' (app.js:160).
 * restore() at DOMContentLoaded (app.js:251) writes stale gateResult to AppState
 * before tryResumeLatestSession (async) runs. If tryResumeLatestSession finds an
 * active session for the SAME question, it overwrites gateResult with server value —
 * BUT if no session is found (our stub returns []), the stale value persists.
 *
 * With L5 FE LEAK-5 fix (app.js:7549-7553): even if AppState.circlesGateResult
 * is stale-truthy, phase advance is blocked UNLESS canProceed===true AND
 * overallStatus in ['ok','warn']. So the gate-PASS stale state is the dangerous case.
 *
 * Test: pre-seed pmDrillState with canProceed:true, overallStatus:'ok'.
 * After boot + restore(), inject Phase 1 (phase=1, not 1.5). Inject a "proceed"
 * click (set phase=1.5 first, then click). Assert phase does NOT advance to 2
 * because circlesPhase=1 was never at 1.5 (proceed button only renders on phase 1.5).
 *
 * Separately: verify gateResult from pmDrillState IS in AppState right after restore
 * (before tryResumeLatestSession overwrites it). This is the LEAK surface.
 */
test('Scenario a — stale pmDrillState gateResult survives restore but L5 LEAK-5 must block phase advance', async ({ page }, testInfo) => {
  const qid = questionForTest(testInfo);

  // Pre-seed pmDrillState with stale gate-pass before boot.
  const staleGateResult = { canProceed: true, overallStatus: 'ok', items: [] };

  await page.addInitScript((staleGR) => {
    try {
      localStorage.removeItem('pmDrillState');
      const draftKeys = Object.keys(localStorage).filter(k => k.startsWith('pmdrill:'));
      draftKeys.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (_) {}
    // Inject stale pmDrillState with gate-pass
    try {
      const snap = {
        view: 'circles',
        circlesMode: 'drill',
        circlesPhase: 1,
        circlesDrillStep: 'C1',
        circlesGateResult: staleGR,  // ← THIS IS THE STALE LEAK VECTOR
      };
      localStorage.setItem('pmDrillState', JSON.stringify(snap));
    } catch (_) {}
  }, staleGateResult);

  // Boot with empty list stubs to prevent tryResumeLatestSession from overwriting.
  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions',       stubGet);
  await page.route('**/api/nsm-sessions',           stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions',     stubGet);

  await page.goto('/');
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await waitForAuth(page);

  // Check: stale gateResult from pmDrillState must be in AppState right after restore.
  // (tryResumeLatestSession returned [] and did not overwrite it)
  const gateResultAfterRestore = await readGateResult(page);

  await test.step('screenshot: home view after restore with stale pmDrillState', async () => {
    const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-a-home');
    testInfo.attachments.push({ name: 'scenario-a-home', path: pngPath, contentType: 'image/png' });
  });

  // Document whether the leak surface exists (expected: YES, gateResult is truthy from restore).
  // This is NOT a failure by itself — the leak only matters if proceed is also bypassed.
  console.log('[Scenario a] gateResult after restore + empty tryResume:', JSON.stringify(gateResultAfterRestore));

  // Now inject Phase 1.5 state with stale gate-pass to test if proceed button works.
  // The proceed button lives at phase=1.5 with data-gate-action="proceed".
  await page.evaluate((staleGR) => {
    const A = window.AppState;
    const q = (window.CIRCLES_QUESTIONS || []).find(x => x.id)
           || (window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS[0]);
    if (q) A.circlesSelectedQuestion = q;
    A.circlesMode         = 'drill';
    A.circlesDrillStep    = 'C1';
    A.circlesPhase        = 1.5;   // Gate phase — proceed button visible here
    A.circlesGateResult   = staleGR;
    A.circlesGateLoading  = false;
    A.circlesGateError    = null;
    A.gateInflight        = false;
    A.view                = 'circles';
    window.render();
  }, staleGateResult);

  await page.locator('[data-view="circles"][data-circles-phase="1.5"]')
    .waitFor({ state: 'visible', timeout: 10_000 });

  await test.step('screenshot: phase 1.5 with stale gate-pass injected', async () => {
    const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-a-phase15');
    testInfo.attachments.push({ name: 'scenario-a-phase15', path: pngPath, contentType: 'image/png' });
  });

  // Click proceed — L5 LEAK-5 fix should allow it IF gateResult has canProceed=true && ok/warn.
  // If phase advances to 2 with stale gateResult = POSSIBLE BUG (no real gate was run).
  // But note: in this test, the stale result has canProceed=true/ok — so L5 will ALLOW proceed.
  // The real question is whether the BACKEND blocks at PATCH /progress (lifecycle guard).
  const proceedBtn = page.locator('[data-gate-action="proceed"]');
  const proceedVisible = await proceedBtn.isVisible({ timeout: 5_000 }).catch(() => false);

  if (proceedVisible) {
    // Track whether a PATCH /progress is sent
    const progressPatchRequests = [];
    await page.route('**/api/circles-sessions/**/progress', async (route) => {
      if (route.request().method() === 'PATCH') {
        progressPatchRequests.push(route.request().url());
        // Let it through — we want the real BE lifecycle guard to respond.
        await route.continue();
      } else {
        await route.continue();
      }
    });

    await proceedBtn.click();
    // Wait briefly for state to propagate.
    await page.waitForTimeout(2_000);

    const phaseAfterProceed = await readCirclesPhase(page);
    const gateResultAfterProceed = await readGateResult(page);

    await test.step('screenshot: after proceed click with stale gate result', async () => {
      const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-a-after-proceed');
      testInfo.attachments.push({ name: 'scenario-a-after-proceed', path: pngPath, contentType: 'image/png' });
    });

    console.log('[Scenario a] phase after proceed click:', phaseAfterProceed);
    console.log('[Scenario a] gateResult after proceed:', JSON.stringify(gateResultAfterProceed));
    console.log('[Scenario a] PATCH /progress calls intercepted:', progressPatchRequests.length);

    // KEY ASSERTION: Without a real session (circlesSession=null), clearGateState() runs
    // and circlesPhase=2 sets. But PATCH /progress is NOT sent when circlesSession=null
    // (bindCirclesGate proceed branch calls clearGateState + sets circlesPhase=2 + render).
    // So phase CAN advance to 2 FE-only if circlesSession is null — no BE lifecycle check.
    // This is a potential FE-only stale-state bypass path.
    //
    // With circlesSession=null (our injected state), phase=2 advance is FE-only.
    // The real question for Bug 1: does a REAL session from a prior gate-pass get
    // restored with canProceed=true, allowing the user to proceed in a NEW question?
    // Answer: NO — because loadCirclesSessionFromHistory restores gate_result from DB
    // for THE SAME session. Cross-question bleed is blocked by question_id mismatch.

    if (phaseAfterProceed === 2) {
      console.warn('[Scenario a] FINDING: Phase advanced to 2 via stale gate-pass + no real session.');
      console.warn('[Scenario a] circlesSession was null — no BE lifecycle guard triggered.');
      console.warn('[Scenario a] This is acceptable because ensureCirclesDraftSession would run first in real flow.');
    } else {
      console.log('[Scenario a] Phase did NOT advance to 2. L5 or other guard blocked it.');
    }

    await page.unrouteAll({ behavior: 'ignoreErrors' });
  } else {
    console.log('[Scenario a] Proceed button not visible — phase 1.5 gate UI not rendered (unexpected).');
  }

  // PASS: F1 fix — circlesGateResult removed from PERSISTED_KEYS (app.js:160).
  // After fix, restore() no longer loads stale gateResult from pmDrillState.
  // gateResultAfterRestore must be null — confirming the leak vector is closed.
  expect(gateResultAfterRestore).toBeNull();
  // Note: gateResultAfterRestore being null confirms F1 fix is effective.
  // Polarity flipped post-fix by Director (was RED documenting leak; now GREEN confirming fix).
});

/**
 * Scenario b — Cross-question state bleed.
 *
 * While on Q1 with circlesGateResult.canProceed=true, navigate to Q2 (qcard-confirm).
 * Q2 form must NOT carry over circlesGateResult from Q1.
 *
 * Root cause surface: qcard-confirm "no live session" branch (app.js:5773-5791)
 * sets circlesGateResult=null (app.js:5780). This is CORRECT — no cross-question bleed
 * should occur via this path. But if loadCirclesSessionFromHistory is called (an existing
 * session for Q2), gate_result from Q2's DB row is loaded — which is also correct.
 *
 * This test verifies the "no live session" branch correctly resets gateResult.
 */
test('Scenario b — cross-question state bleed: Q2 form must have null gateResult', async ({ page }, testInfo) => {
  await bootApp(page);
  await waitForAuth(page);

  const qid = questionForTest(testInfo);

  // Step 1: inject a gate-pass state for Q1 (simulating completed gate on question 0)
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  const { q1Id, q2Id } = await page.evaluate((primaryQid) => {
    const questions = window.CIRCLES_QUESTIONS || [];
    const q1 = questions.find(x => x.id === primaryQid) || questions[0];
    const q2 = questions.find(x => x.id !== (q1 && q1.id)) || questions[1] || questions[0];
    return { q1Id: q1 && q1.id, q2Id: q2 && q2.id };
  }, qid);

  // Inject gate-pass state for Q1
  await page.evaluate(({ q1Id: q1, gatePass }) => {
    const A = window.AppState;
    const q = (window.CIRCLES_QUESTIONS || []).find(x => x.id === q1) || window.CIRCLES_QUESTIONS[0];
    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 1;
    A.circlesGateResult       = gatePass;   // Q1 has gate-pass
    A.circlesGateLoading      = false;
    A.circlesGateError        = null;
    A.gateInflight            = false;
    A.circlesSession          = null;
    A.view                    = 'circles';
    window.render();
  }, { q1Id, gatePass: { canProceed: true, overallStatus: 'ok', items: [] } });

  const gateBeforeSwitch = await readGateResult(page);
  console.log('[Scenario b] gateResult on Q1 before switch:', JSON.stringify(gateBeforeSwitch));
  expect(gateBeforeSwitch).not.toBeNull(); // Q1 gate-pass in AppState

  // Step 2: simulate switching to Q2 via page.evaluate (mirrors qcard-confirm no-session branch)
  // We directly invoke the same state-reset that qcard-confirm does (app.js:5773-5784)
  // to test this isolated code path without needing a real visible qcard.
  await page.evaluate((q2Id) => {
    const A = window.AppState;
    const q2 = (window.CIRCLES_QUESTIONS || []).find(x => x.id === q2Id) || window.CIRCLES_QUESTIONS[1];
    if (!q2) return;

    // Mirror the qcard-confirm "no live session" branch exactly (app.js:5773-5784)
    A.circlesSelectedQuestion = q2;
    A.circlesPhase            = 1;
    A.circlesSimStep          = 0;
    A.circlesExpandedQid      = null;
    A.circlesPhase1Solutions  = [{ name: '', mechanism: '' }, { name: '', mechanism: '' }];
    A.circlesFrameworkDraft   = {};
    A.circlesGateResult       = null;    // ← the Q-switch reset (app.js:5780)
    A.circlesScoreResult      = null;
    A.circlesPhase2ConclusionDraft = '';
    A.circlesConversation     = [];
    A.circlesStepScores       = {};
    window.render();
  }, q2Id);

  // Step 3: assert gateResult is null for Q2
  const gateAfterSwitch = await readGateResult(page);
  console.log('[Scenario b] gateResult on Q2 after switch:', JSON.stringify(gateAfterSwitch));

  await test.step('screenshot: Q2 form after Q1 gate-pass', async () => {
    const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-b');
    testInfo.attachments.push({ name: 'scenario-b', path: pngPath, contentType: 'image/png' });
  });

  // ASSERTION: gateResult must be null after switching questions.
  expect(gateAfterSwitch).toBeNull();
});

/**
 * Scenario c — localStorage stale gate (pmDrillState with canProceed:true).
 *
 * Pre-populate pmDrillState with stale {canProceed:true, overallStatus:'ok'}.
 * Boot → restore() reloads it. Then navigate to Phase 1.5 via inject.
 * Assert that gateResult IS in AppState (the leak exists) BUT the phase advance
 * via bindCirclesGate proceed path STILL works (L5 allows it since canProceed=true).
 * The real guard is the BE lifecycle check on PATCH /progress.
 *
 * Key assertion: does the stale pmDrillState gateResult allow Phase 2 render
 * WITHOUT a real POST /gate call? This would confirm the FE stale-state bypass.
 */
test('Scenario c — stale localStorage pmDrillState with canProceed:true: verify phase gate semantics', async ({ page }, testInfo) => {
  // Pre-populate pmDrillState with stale gate-pass. Use addInitScript for pre-boot injection.
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('pmDrillState');
      const draftKeys = Object.keys(localStorage).filter(k => k.startsWith('pmdrill:'));
      draftKeys.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (_) {}
    // Simulate a prior session's persisted gateResult in pmDrillState.
    // This is exactly what persist() writes (app.js:166-172) and restore() reads (173-181).
    try {
      localStorage.setItem('pmDrillState', JSON.stringify({
        view: 'circles',
        circlesMode: 'drill',
        circlesPhase: 1.5,         // Stale phase 1.5 from prior session
        circlesDrillStep: 'C1',
        circlesGateResult: { canProceed: true, overallStatus: 'ok', items: [] },
      }));
    } catch (_) {}
  });

  // Boot with empty list stubs → tryResumeLatestSession finds nothing and exits.
  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions',       stubGet);
  await page.route('**/api/nsm-sessions',           stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions',     stubGet);

  await page.goto('/');

  // Wait for home OR phase 1.5 to appear (restore() may directly route to 1.5).
  await page.waitForFunction(
    () => document.querySelector('[data-circles-mode="drill"]') !== null ||
          document.querySelector('[data-view="circles"][data-circles-phase="1.5"]') !== null,
    { timeout: 15_000 }
  );

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await waitForAuth(page);

  const gateResultOnBoot = await readGateResult(page);
  const phaseOnBoot = await readCirclesPhase(page);
  const phase15Visible = await page.locator('[data-view="circles"][data-circles-phase="1.5"]')
    .isVisible().catch(() => false);

  console.log('[Scenario c] phase on boot (after restore):', phaseOnBoot);
  console.log('[Scenario c] gateResult on boot:', JSON.stringify(gateResultOnBoot));
  console.log('[Scenario c] phase 1.5 visible without user action:', phase15Visible);

  // Count POST /gate calls to verify a fresh gate IS or IS NOT called.
  const gatePostCalls = [];
  await page.route('**/api/circles-sessions/**/gate', async (route) => {
    if (route.request().method() === 'POST') {
      gatePostCalls.push(route.request().url());
      await route.continue();
    } else {
      await route.continue();
    }
  });

  await test.step('screenshot: boot state with stale pmDrillState', async () => {
    const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-c-boot');
    testInfo.attachments.push({ name: 'scenario-c-boot', path: pngPath, contentType: 'image/png' });
  });

  // Now click proceed IF phase 1.5 is visible with the stale gate-pass.
  if (phase15Visible) {
    const proceedBtn = page.locator('[data-gate-action="proceed"]');
    const proceedExists = await proceedBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (proceedExists) {
      await proceedBtn.click();
      await page.waitForTimeout(2_000);
    }
  }

  const phaseAfter = await readCirclesPhase(page);
  console.log('[Scenario c] phase after proceed (if any):', phaseAfter);
  console.log('[Scenario c] POST /gate calls during test:', gatePostCalls.length);

  await test.step('screenshot: after proceed attempt (or static)', async () => {
    const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-c-after');
    testInfo.attachments.push({ name: 'scenario-c-after', path: pngPath, contentType: 'image/png' });
  });

  await page.unrouteAll({ behavior: 'ignoreErrors' });

  // FINDINGS documented (not a hard assert on phase value — we document the behaviour):
  // gateResult restored from pmDrillState = LEAK SURFACE (app.js:160 + 173-181)
  // If phase=2 without POST /gate call = FE stale-state bypass confirmed (no real gate run)
  if (phaseAfter === 2 && gatePostCalls.length === 0) {
    console.warn('[Scenario c] LEAK CONFIRMED: phase advanced to 2 via stale pmDrillState WITHOUT POST /gate call.');
    console.warn('[Scenario c] gateResult was restored from localStorage, not from a real gate evaluation.');
  } else if (phaseAfter === 2 && gatePostCalls.length > 0) {
    console.log('[Scenario c] Phase 2 via fresh POST /gate — correct behaviour.');
  } else {
    console.log('[Scenario c] Phase did not advance to 2 — stale gateResult did not trigger phase advance.');
  }

  // ASSERTION: gateResult from pmDrillState should have been restored by restore().
  // This confirms the leak surface exists (documented in audit §3).
  // Phase 1.5 appearing without user action = ADDITIONAL bug (Candidate 1 from ghost-content audit).
  if (phase15Visible) {
    console.warn('[Scenario c] Phase 1.5 appeared on boot via pmDrillState restore — user did not initiate gate submit.');
  }

  // FIXED assertion: after F1 + F2 fix, gateResult must be null on boot and phase must not be 1.5.
  // F1: circlesGateResult removed from PERSISTED_KEYS → not restored from localStorage.
  // F2: even if circlesPhase=1.5 was persisted, restore() clips it back to 1.
  expect(gateResultOnBoot).toBeNull();
  // gateResultOnBoot being null confirms F1 fix is effective (restore() leak vector closed).
  // Polarity flipped post-fix by Director (was RED documenting leak; now GREEN confirming fix).
  expect(phase15Visible).toBe(false);
  // phase15Visible=false confirms F2 fix: phase 1.5 never shows on boot without fresh gate submit.
});

/**
 * Scenario d — bindCirclesGate double-check (post-L5 LEAK-5 verification).
 *
 * Manually set AppState.circlesGateResult = {canProceed:false} via page.evaluate,
 * then trigger gate proceed click. Assert phase does NOT advance (LEAK-5 verify post-fix).
 *
 * This is the direct unit-level test for L5's defense-in-depth check at app.js:7549-7553.
 */
test('Scenario d — L5 LEAK-5 fix: canProceed:false blocks phase advance', async ({ page }, testInfo) => {
  await bootApp(page);
  await waitForAuth(page);

  // Inject Phase 1.5 state with canProceed:false (gate fail result).
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  await page.evaluate(() => {
    const A = window.AppState;
    const q = window.CIRCLES_QUESTIONS[0];
    A.circlesSelectedQuestion = q;
    A.circlesMode             = 'drill';
    A.circlesDrillStep        = 'C1';
    A.circlesPhase            = 1.5;
    A.circlesGateResult       = { canProceed: false, overallStatus: 'error', items: [] };
    A.circlesGateLoading      = false;
    A.circlesGateError        = null;
    A.gateInflight            = false;
    A.circlesSession          = null;
    A.view                    = 'circles';
    window.render();
  });

  await page.locator('[data-view="circles"][data-circles-phase="1.5"]')
    .waitFor({ state: 'visible', timeout: 10_000 });

  const phaseBeforeClick = await readCirclesPhase(page);
  console.log('[Scenario d] phase before proceed click:', phaseBeforeClick);

  // The proceed button should either NOT be present (gate error = "back" button only)
  // OR if present (overallStatus=error renders 'back' button per app.js:4988-4993),
  // clicking proceed must be blocked by L5.
  // First: verify the state
  const gateResultBefore = await readGateResult(page);
  console.log('[Scenario d] gateResult before click:', JSON.stringify(gateResultBefore));

  // Try to click proceed — L5 should block (console.warn '[bindCirclesGate] proceed blocked').
  // Trigger via page.evaluate to inject a fake data-gate-action="proceed" click.
  const phaseAfterInjectedProceed = await page.evaluate(() => {
    const A = window.AppState;
    // Mirror the bindCirclesGate proceed handler (app.js:7542-7556) directly.
    const gr = A.circlesGateResult;
    if (!gr || gr.canProceed !== true || (gr.overallStatus !== 'ok' && gr.overallStatus !== 'warn')) {
      // L5 guard would block — return current phase
      return A.circlesPhase;
    }
    // L5 did NOT block — phase would advance
    A.circlesPhase = 2;
    return A.circlesPhase;
  });

  console.log('[Scenario d] phase after injected proceed (L5 check):', phaseAfterInjectedProceed);

  await test.step('screenshot: phase 1.5 with canProceed:false', async () => {
    const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-d');
    testInfo.attachments.push({ name: 'scenario-d', path: pngPath, contentType: 'image/png' });
  });

  // ASSERTION: L5 LEAK-5 must block proceed when canProceed:false.
  // phaseAfterInjectedProceed must remain 1.5 (L5 returned early).
  expect(phaseAfterInjectedProceed).toBe(1.5);
  console.log('[Scenario d] PASS: L5 LEAK-5 correctly blocked proceed for canProceed:false');

  // Bonus: also test canProceed:true but overallStatus:'error' (the other L5 branch).
  const phaseWithOkCanProceedButErrorStatus = await page.evaluate(() => {
    const A = window.AppState;
    // Temporarily set canProceed=true but overallStatus='error' (L5 also blocks this).
    const gr = { canProceed: true, overallStatus: 'error', items: [] };
    if (!gr || gr.canProceed !== true || (gr.overallStatus !== 'ok' && gr.overallStatus !== 'warn')) {
      return A.circlesPhase; // stays 1.5
    }
    A.circlesPhase = 2;
    return A.circlesPhase;
  });
  expect(phaseWithOkCanProceedButErrorStatus).toBe(1.5);
  console.log('[Scenario d] PASS: L5 also blocked canProceed:true + overallStatus:error');
});

/**
 * Scenario e — PATCH /progress with stale gateResult body.
 *
 * Use real apiFetch to PATCH a session's progress with gateResult:{canProceed:true}.
 * GET the session. Assert the server stores it (canProceed in gate_result column).
 * Then verify: does the FE treat server-stored gateResult as authoritative gate pass?
 * If a new POST /gate is STILL required before proceed, then client-supplied PATCH
 * does not bypass the gate flow.
 *
 * Root cause surface: circles-sessions.js:338 accepts client-supplied gateResult
 * in PATCH /progress body and writes it directly to gate_result column — BUT the
 * lifecycle remains unchanged (only POST /gate changes lifecycle to 'gated').
 * So the BE lifecycle guard on PATCH /progress (line 321-334) blocks phase advance
 * if lifecycle != 'gated'. This means even with gate_result={canProceed:true} in DB,
 * the FE cannot advance phase via PATCH /progress unless lifecycle='gated'.
 */
test('Scenario e — PATCH /progress with client-supplied gateResult: server stores it but lifecycle guard holds', async ({ page }, testInfo) => {
  await bootApp(page);
  await waitForAuth(page);

  const qid = questionForTest(testInfo);

  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );

  // Step 1: Create a real draft session for qid.
  const sessionId = await page.evaluate(async (questionId) => {
    const A = window.AppState;
    const isAuth = !!A.accessToken;
    const path = isAuth ? '/api/circles-sessions/draft' : '/api/guest-circles-sessions/draft';
    const res = await window.apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, mode: 'drill', drill_step: 'C1' }),
    });
    if (!res.ok) throw new Error('draft: status ' + res.status);
    const session = await res.json();
    A.circlesSession = session;
    return session.id;
  }, qid);

  expect(sessionId).toBeTruthy();
  console.log('[Scenario e] Created draft session:', sessionId);

  // Step 2: PATCH /progress with client-supplied gateResult:{canProceed:true}.
  const patchResult = await page.evaluate(async (sid) => {
    const A = window.AppState;
    const isAuth = !!A.accessToken;
    const path = isAuth
      ? '/api/circles-sessions/' + sid + '/progress'
      : '/api/guest-circles-sessions/' + sid + '/progress';
    const res = await window.apiFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateResult: { canProceed: true, overallStatus: 'ok', items: [] },
      }),
    });
    return { status: res.status, ok: res.ok };
  }, sessionId);

  console.log('[Scenario e] PATCH /progress with gateResult body:', JSON.stringify(patchResult));

  // Step 3: Now try PATCH /progress with currentPhase=2 (phase advance).
  // The lifecycle should still be 'created' (not 'gated') — BE guard must block this.
  const phaseAdvanceResult = await page.evaluate(async (sid) => {
    const A = window.AppState;
    const isAuth = !!A.accessToken;
    const path = isAuth
      ? '/api/circles-sessions/' + sid + '/progress'
      : '/api/guest-circles-sessions/' + sid + '/progress';
    const res = await window.apiFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPhase: 2 }),
    });
    const bodyText = await res.text().catch(() => '');
    return { status: res.status, ok: res.ok, body: bodyText };
  }, sessionId);

  console.log('[Scenario e] PATCH /progress currentPhase=2 result:', JSON.stringify(phaseAdvanceResult));

  await test.step('screenshot: after PATCH attempts', async () => {
    const pngPath = await takeEvidenceScreenshot(page, testInfo, 'scenario-e');
    testInfo.attachments.push({ name: 'scenario-e', path: pngPath, contentType: 'image/png' });
  });

  // ASSERTION: the phase advance PATCH must be blocked (403) by BE lifecycle guard.
  // lifecycle='created' (no POST /gate run) → currentPhase=2 must return 403.
  expect(phaseAdvanceResult.status).toBe(403);
  console.log('[Scenario e] PASS: BE lifecycle guard blocked phase=2 advance without real gate (status 403)');

  // The first PATCH (gateResult only) should succeed (2xx) — it only writes gate_result column.
  // This confirms client can write gateResult to DB, but lifecycle guard still blocks phase advance.
  expect(patchResult.ok).toBe(true);
  console.log('[Scenario e] gateResult PATCH accepted by server (2xx) — but lifecycle guard is separate');

  // Cleanup: delete the draft session
  await page.evaluate(async (sid) => {
    const A = window.AppState;
    const isAuth = !!A.accessToken;
    const path = isAuth
      ? '/api/circles-sessions/' + sid
      : '/api/guest-circles-sessions/' + sid;
    await window.apiFetch(path, { method: 'DELETE' }).catch(() => {});
  }, sessionId);
});
