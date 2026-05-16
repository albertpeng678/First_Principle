// tests/e2e/circles-gate-await-patch-real.spec.js
//
// Plan #194 T3 (RES-AC4) — real Playwright e2e proving the gateResult PATCH
// is AWAITED before gate-pass UI renders, so the row is durable in Supabase
// before the user advances phase or closes the tab.
//
// Skill refs applied (per playwright-skill at /Users/albertpeng/.claude/skills/playwright-skill/):
//   - network-mocking.md lines 906-933: intermittent-failure simulation
//     (attempt counter + route.fulfill 503 for first N, then route.continue)
//   - network-mocking.md lines 1012-1027: route handler to count requests
//   - assertions-and-waiting.md: explicit "no event" check via waitForTimeout
//     when proving ABSENCE of UI change (gate-pass NOT rendered while PATCH stalls)
//   - fixtures-and-hooks.md lines 19-60: finally-block cleanup for real DB rows
//
// BOUNDARY RATIONALE
// ──────────────────
// The bug being fixed: previous fire-and-forget IIFE called persistRetry without
// `await`, then immediately set AppState.circlesGateResult + render() — exposing a
// race where (a) cross-device sync read empty gateResult, or (b) browser close
// mid-flight lost the PATCH entirely. Tests must prove the FIX awaits the PATCH
// at the integration boundary (browser → Express → Supabase), not via a unit mock.
//
// page.route() intercepts browser→server calls — the correct layer to inject the
// 503 fault that triggers persistRetry, then assert the UI does NOT advance until
// the route eventually returns 200 (or exhausts to RetryExhausted).
//
// REAL-DATA DISCIPLINE (per memory feedback_e2e_real_data_only)
// ──────────────────────────────────────────────────────────────
//  - No stub timestamps in payload — uses factory.quality() zh-TW content
//  - No mock of our own gate POST endpoint in TC1/TC2 — real OpenAI runs
//  - TC3 mocks /progress route only (own API, allowed for error injection per
//    when-to-mock.md carve-out — sustained 503 cannot be deterministically
//    triggered at the Supabase layer from the browser)
//  - Real session row in Supabase; cleanup in finally; ISOLATION via distinct
//    qIndex per test (avoids POST /draft idempotent collision on
//    question_id + mode + drill_step).

'use strict';

const { test, expect } = require('@playwright/test');
const factory = require('../factories/circles-phase1.factory');

// ── Project-aware qIndex base ─────────────────────────────────────────────────
// All e2e projects (desktop/mobile-chrome/mobile-safari) run in parallel against
// the SAME auth user. POST /draft is idempotent on (question_id, mode, drill_step)
// → same session row. Disjoint qIndex slices per project = no collision.
// Also kept clear of other specs' ranges (persist-retry uses 3-5;
// circles-delete-rollback uses 2-4 / 6-8 / 10-12; phase3-restore-real uses 0-2).
// Pick high range 80-99 to stay clear of everyone.
function projectQuestionBase(testInfo) {
  const name = (testInfo && testInfo.project && testInfo.project.name) || '';
  if (name === 'e2e-mobile-chrome')  return 86;
  if (name === 'e2e-mobile-safari')  return 92;
  return 80; // e2e-desktop
}

// ── Boot helper ───────────────────────────────────────────────────────────────
async function bootToPhase1Drill(page, qIndex) {
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
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  const c1 = factory.quality().C1;
  await page.evaluate(({ qualityC1, idx }) => {
    const A = window.AppState;
    if (!A || !window.CIRCLES_QUESTIONS || !window.CIRCLES_QUESTIONS.length) return;
    const q = window.CIRCLES_QUESTIONS[idx] || window.CIRCLES_QUESTIONS[0];

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
    A.circlesFrameworkDraft['C1'] = qualityC1;

    window.render();
  }, { qualityC1: c1, idx: qIndex });

  await page.locator('button.btn--primary[data-phase1="submit"]').waitFor({ state: 'visible', timeout: 10_000 });
}

// ── Fire gate bypassing Layer 1 validator ─────────────────────────────────────
// (drill mode validator always fails I-section — matches circles-gate.spec.js pattern)
async function fireGateBypassingValidator(page) {
  await page.evaluate(() => {
    const saved = window.frameworkValidator;
    window.frameworkValidator = null;
    try {
      window.submitFrameworkToGate();
    } finally {
      window.frameworkValidator = saved;
    }
  });
}

// ── Cleanup helper (Bearer token from window.apiFetch, not request fixture) ───
async function cleanupSession(page, sid) {
  if (!sid) return;
  try {
    await page.evaluate(async (sessionId) => {
      try {
        await window.apiFetch('/api/circles-sessions/' + sessionId, { method: 'DELETE' });
      } catch (_) {}
    }, sid);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// TC1: happy await — gate-pass UI does NOT render until PATCH /progress lands.
// Mock PATCH /progress to delay so we can observe the loading state persists
// during the in-flight PATCH, then assert gate-pass appears only AFTER PATCH
// responds 200 + persistRetry resolves.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('T3 RES-AC4 — gateResult PATCH is awaited before gate-pass renders', () => {

  test('TC1 happy: gate-pass UI renders only AFTER PATCH /progress lands', async ({ page }, testInfo) => {
    await bootToPhase1Drill(page, projectQuestionBase(testInfo) + 0);

    let patchAttempts = 0;
    let patchResolveAt = 0;
    // Intermittent-failure pattern per network-mocking.md lines 906-933.
    // First call → delay 1500ms then 200 (simulates slow but successful PATCH).
    // We use the delay to observe that gate-pass UI is NOT rendered mid-flight.
    await page.route('**/api/circles-sessions/*/progress', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      patchAttempts++;
      // Delay so the await is observable from the UI side.
      await new Promise(r => setTimeout(r, 1500));
      patchResolveAt = Date.now();
      await route.continue(); // hits real Express + real Supabase
    });

    let sid = null;
    try {
      // Fire gate. Then wait for the PATCH /progress REQUEST to be fired
      // (network-mocking.md lines 1012-1027 waitForRequest predicate). The
      // PATCH starts only AFTER the gate POST returns + JSON.parse, so when
      // waitForRequest resolves we are guaranteed: gate POST done AND PATCH
      // mock invoked AND we are inside the 1500ms PATCH delay window.
      await fireGateBypassingValidator(page);

      const patchReqPromise = page.waitForRequest(
        (req) => /\/progress$/.test(req.url()) && req.method() === 'PATCH',
        { timeout: 90_000 }
      );
      await patchReqPromise;
      const patchFiredAt = Date.now();

      // Capture sid for cleanup.
      sid = await page.evaluate(() => {
        const s = window.AppState && window.AppState.circlesSession;
        return s && s.id;
      });

      // CRITICAL ASSERTION (RES-AC4): while PATCH is in flight (1500ms delay),
      // gate-pass UI must NOT be rendered (circlesGateResult must still be null).
      // Sample immediately — we are deterministically inside the delay window.
      const midFlight = await page.evaluate(() => ({
        gateResult: window.AppState && window.AppState.circlesGateResult,
        gateLoading: window.AppState && window.AppState.circlesGateLoading,
        gatePassVisible: !!document.querySelector('.gate-content > .gate-wrap'),
      }));
      expect(midFlight.gateResult, 'gate-pass must NOT be rendered while PATCH in flight').toBeNull();
      expect(midFlight.gateLoading, 'loading state must persist during PATCH').toBe(true);
      expect(midFlight.gatePassVisible, 'gate-wrap DOM must not be present mid-flight').toBe(false);

      // Wait for PATCH to land (delay window closes at 1500ms after invocation).
      await page.waitForResponse(
        (r) => /\/progress$/.test(r.url()) && r.request().method() === 'PATCH',
        { timeout: 10_000 }
      );

      // Now gate-pass should appear (persistRetry resolves → AppState set → render()).
      await page.locator('.gate-content > .gate-wrap').waitFor({ state: 'visible', timeout: 5_000 });

      // Verify ordering: PATCH RESOLVED AFTER it was FIRED (sanity for delay logic).
      expect(patchResolveAt, 'PATCH must resolve after it fires').toBeGreaterThan(patchFiredAt);
      expect(patchAttempts, 'Expected exactly 1 PATCH attempt on happy path').toBe(1);

      // Final state: gateResult populated, loading cleared, no error.
      const finalState = await page.evaluate(() => ({
        gateResult: !!(window.AppState && window.AppState.circlesGateResult),
        gateLoading: window.AppState && window.AppState.circlesGateLoading,
        gateError: window.AppState && window.AppState.circlesGateError,
      }));
      expect(finalState.gateResult).toBe(true);
      expect(finalState.gateLoading).toBe(false);
      expect(finalState.gateError).toBeNull();
    } finally {
      await cleanupSession(page, sid);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC2: cross-device sync — gateResult MUST be in DB after gate-pass renders.
  // No mocking — real PATCH flows through to Supabase. After gate-pass UI
  // appears, immediately GET the session via real API and assert gate_result
  // column is populated. Simulates "user closes browser right after gate" —
  // because the FE awaited the PATCH, the DB row is durable.
  // ───────────────────────────────────────────────────────────────────────────
  test('TC2 cross-device: gateResult persisted to Supabase before gate-pass renders', async ({ page }, testInfo) => {
    await bootToPhase1Drill(page, projectQuestionBase(testInfo) + 1);

    let sid = null;
    try {
      await fireGateBypassingValidator(page);

      // Wait for gate POST + the awaited PATCH chain to fully resolve.
      await page.locator('.gate-content > .gate-wrap').waitFor({ state: 'visible', timeout: 90_000 });

      // Capture sid AFTER gate-pass visible — at this moment, PATCH is guaranteed landed.
      sid = await page.evaluate(() => {
        const s = window.AppState && window.AppState.circlesSession;
        return s && s.id;
      });
      expect(sid).toBeTruthy();

      // Real GET via apiFetch (carries auth token) — verifies what a different
      // device would see if it queried the same session right now.
      const persisted = await page.evaluate(async (sessionId) => {
        const res = await window.apiFetch('/api/circles-sessions/' + sessionId);
        if (!res.ok) return { error: 'http_' + res.status };
        return res.json();
      }, sid);

      expect(persisted.error, `GET session failed: ${JSON.stringify(persisted)}`).toBeUndefined();
      // gate_result column (DB) — populated by the awaited PATCH /progress.
      expect(persisted.gate_result, 'gate_result must be persisted in Supabase').toBeTruthy();
      expect(persisted.gate_result.items, 'gate_result.items must be present').toBeTruthy();
      expect(Array.isArray(persisted.gate_result.items)).toBe(true);
      expect(persisted.gate_result.items.length).toBeGreaterThan(0);

      // Sanity: gateResult in AppState equals gate_result in DB (byte-for-byte structure).
      const appGateResult = await page.evaluate(() => window.AppState && window.AppState.circlesGateResult);
      expect(appGateResult.overallStatus).toBe(persisted.gate_result.overallStatus);
      expect(appGateResult.items.length).toBe(persisted.gate_result.items.length);
    } finally {
      await cleanupSession(page, sid);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC3: retry exhaust — sustained 503 on PATCH → RetryExhausted → GATE_SYNC_ERROR
  // banner shown, AppState.circlesGateResult = null, phase NOT advanced to 2.
  // ───────────────────────────────────────────────────────────────────────────
  test('TC3 exhaust: sustained 503 on PATCH → banner + no phase advance + gateResult null', async ({ page }, testInfo) => {
    await bootToPhase1Drill(page, projectQuestionBase(testInfo) + 2);

    let patchAttempts = 0;
    // Sustained 503 — all attempts fail. persistRetry default is 4 attempts.
    await page.route('**/api/circles-sessions/*/progress', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      patchAttempts++;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service Unavailable (sustained fault for T3 exhaust test)' }),
      });
    });

    let sid = null;
    try {
      await fireGateBypassingValidator(page);

      // Wait for gate POST to complete (real OpenAI).
      await page.waitForResponse('**/api/circles-sessions/*/gate', { timeout: 60_000 });

      sid = await page.evaluate(() => {
        const s = window.AppState && window.AppState.circlesSession;
        return s && s.id;
      });

      // Wait for persistRetry to exhaust all 4 attempts (~1.75s backoff total + jitter).
      // .error-wrap is the renderGateError container — GATE_SYNC_ERROR variant shown.
      await page.locator('.gate-content > .error-wrap').waitFor({ state: 'visible', timeout: 15_000 });

      // Assert the SYNC error code is rendered (not GATE_API_ERROR/TIMEOUT).
      const errorCode = await page.locator('.error-wrap__code').textContent();
      expect(errorCode).toBe('GATE_SYNC_ERROR');

      // Assert zh-TW message per spec §5.3.
      const errorSub = await page.locator('.error-wrap__sub').textContent();
      expect(errorSub).toContain('跨裝置同步失敗');

      // AppState invariants on exhaust path:
      const state = await page.evaluate(() => ({
        gateResult: window.AppState && window.AppState.circlesGateResult,
        gateError: window.AppState && window.AppState.circlesGateError,
        gateLoading: window.AppState && window.AppState.circlesGateLoading,
        phase: window.AppState && window.AppState.circlesPhase,
      }));
      expect(state.gateResult, 'circlesGateResult must be cleared on exhaust').toBeNull();
      expect(state.gateError).toBe('GATE_SYNC_ERROR');
      expect(state.gateLoading).toBe(false);
      // Phase MUST NOT advance to 2 — user stays on Phase 1.5 with error banner.
      expect(state.phase, 'phase must NOT advance to 2 on exhaust').not.toBe(2);

      // Verify all 4 retry attempts fired (persistRetry default maxAttempts=4).
      expect(patchAttempts, 'Expected 4 PATCH attempts on exhaust').toBe(4);

      // Proceed button must NOT be in the DOM (renderGateError shows retry/back only).
      const proceedCount = await page.locator('[data-gate-action="proceed"]').count();
      expect(proceedCount, 'proceed button must not exist on error variant').toBe(0);
    } finally {
      await cleanupSession(page, sid);
    }
  });

});
