// tests/e2e/circles-draft-retry-real.spec.js
//
// Plan #194 T4 (RES-AC5) — real Playwright e2e proving ensureCirclesDraftSession
// retries on 5xx/network failure via window.persistRetry, and on exhaust shows
// the DRAFT_CREATE_FAILED banner with a clickable "重新嘗試" button that
// re-triggers the flow.
//
// Skill refs applied (per playwright-skill at /Users/albertpeng/.claude/skills/playwright-skill/):
//   - auth-flows.md lines 928-949: API-seed pattern — submitFrameworkToGate
//     bypasses Layer 1 validator via in-page window.frameworkValidator nulling
//     (matches circles-gate.spec.js / circles-gate-await-patch-real.spec.js).
//   - common-pitfalls.md Pitfall 11 (lines 597-661): NO own-backend mock except
//     503 simulation for error injection (carve-out at line 660).
//   - network-mocking.md lines 839-933 (Network Error Simulation +
//     intermittent-failures): page.route fulfill 503 with attempt counter, then
//     route.continue() for happy retry; route.fulfill 503 sustained for exhaust.
//
// BOUNDARY RATIONALE
// ──────────────────
// The fix wraps ensureCirclesDraftSession (POST /api/circles-sessions/draft)
// in window.persistRetry. page.route intercepts the browser→server POST — the
// correct layer to inject the 503 fault. Real Supabase row creation happens
// when retries succeed (recovery TC) or never (exhaust TC); the retry-click TC
// re-triggers the entire submitFrameworkToGate path.
//
// REAL-DATA DISCIPLINE (per memory feedback_e2e_real_data_only)
// ──────────────────────────────────────────────────────────────
//  - No stub timestamps in payload — uses factory.quality() zh-TW content
//  - 503 simulation only (own-API mock is acceptable for error states per
//    when-to-mock carve-out — sustained 5xx cannot be deterministically
//    injected at Supabase from the browser)
//  - Real Supabase row on TC1 happy retry — cleanup in finally
//  - ISOLATION: distinct qIndex slice per test + per project (avoids POST
//    /draft idempotent collision on question_id + mode + drill_step)
//

'use strict';

const { test, expect } = require('@playwright/test');
const factory = require('../factories/circles-phase1.factory');

// ── Project-aware qIndex base ─────────────────────────────────────────────────
// Plan T4 carves out qIndex range 60-79 (clear of T3 await-patch 80-99,
// persist-retry 3-5, delete-rollback 2-12, phase3-restore 0-2).
function projectQuestionBase(testInfo) {
  const name = (testInfo && testInfo.project && testInfo.project.name) || '';
  if (name === 'e2e-mobile-chrome')  return 66;
  if (name === 'e2e-mobile-safari')  return 72;
  return 60; // e2e-desktop
}

// ── Boot helper ───────────────────────────────────────────────────────────────
// onDraftRouteSetup: optional callback fired with `page` BEFORE the render() that
// triggers preflightDraftSession — so the spec can install its /draft mock and
// prevent a race between preflight (POST /draft to real backend) and the test's
// retry-count assertions.
async function bootToPhase1Drill(page, qIndex, onDraftRouteSetup) {
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

  // CRITICAL: install /draft mock BEFORE the evaluate() call below, because that
  // evaluate triggers render() → preflightDraftSession() → POST /draft. Without
  // a mock installed here, preflight hits the real Express + Supabase and may
  // win the race against the test's retry-count assertions (creating a real
  // session row that satisfies the early-return guard in ensureCirclesDraftSession).
  if (typeof onDraftRouteSetup === 'function') {
    await onDraftRouteSetup(page);
  }

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
    A.circlesSession          = null; // critical: force ensureCirclesDraftSession to fire
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
// drill mode validator always fails I-section — matches circles-gate.spec.js pattern.
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

// ── Cleanup helper ────────────────────────────────────────────────────────────
// Real Supabase row deletion via window.apiFetch (carries auth from storageState).
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
// TC1 — Happy retry: POST /draft 503 × 1 then 200 → gate flow proceeds without
// user re-click; banner NEVER appears.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('T4 RES-AC5 — ensureCirclesDraftSession retries on 5xx + DRAFT_CREATE_FAILED banner', () => {

  test('TC1 happy retry: POST /draft 503 → 200 → gate proceeds, no banner', async ({ page }, testInfo) => {
    page.on('console', (msg) => console.log('[browser]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('[pageerror]', err.message));
    page.on('request', (req) => {
      if (/circles-sessions/.test(req.url())) {
        console.log('[req]', req.method(), req.url());
      }
    });
    // submitFiredCounting: only count attempts AFTER submitFrameworkToGate fires
    // — the preflightDraftSession at render time would otherwise inflate the count.
    let countingEnabled = false;
    let draftAttempts = 0;
    let firstAttemptIsFault = true; // first attempt during counting → 503

    await bootToPhase1Drill(page, projectQuestionBase(testInfo) + 0, async (pg) => {
      // Mock installed BEFORE preflight fires so race is deterministic.
      // Pre-counting phase: preflight hits this route. Drop it (return 503) so
      // preflight never creates a real session row that would short-circuit
      // ensureCirclesDraftSession's early-return guard.
      await pg.route('**/api/circles-sessions/draft', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        if (countingEnabled) {
          draftAttempts++;
          if (firstAttemptIsFault) {
            firstAttemptIsFault = false;
            await route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Service Unavailable (T4 TC1 injected fault)' }),
            });
            return;
          }
          await route.continue(); // 2nd attempt onward → real backend
          return;
        }
        // Pre-counting (preflight) — always 503 so no real session row created.
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service Unavailable (preflight blocked)' }),
        });
      });
    });

    let sid = null;
    try {
      // Enable counting just before submit so preflight attempts don't count.
      countingEnabled = true;
      await fireGateBypassingValidator(page);

      // Wait for a SUCCESSFUL POST /draft (status 200) — proves retry succeeded.
      await page.waitForResponse(
        (r) => /\/circles-sessions\/draft$/.test(r.url())
            && r.request().method() === 'POST'
            && r.status() === 200,
        { timeout: 30_000 }
      );

      // Wait for gate POST to follow (proves ensureCirclesDraftSession returned a sid).
      await page.waitForResponse(
        (r) => /\/circles-sessions\/.+\/gate$/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 60_000 }
      );

      // Banner must NOT appear — retry covered the transient 503 silently.
      const errorWrapCount = await page.locator('.gate-content > .error-wrap').count();
      expect(errorWrapCount, 'DRAFT_CREATE_FAILED banner must NOT appear after successful retry').toBe(0);

      // Verify retry counter — exactly 2 attempts: 1 fault + 1 success.
      expect(draftAttempts, 'Expected exactly 2 POST /draft attempts during gate flow (1 × 503 + 1 × 200)').toBe(2);

      // Capture sid for cleanup.
      sid = await page.evaluate(() => {
        const s = window.AppState && window.AppState.circlesSession;
        return s && s.id;
      });
      expect(sid, 'circlesSession.id must be set after successful retry').toBeTruthy();

      // AppState invariants: no DRAFT_CREATE_FAILED error.
      const state = await page.evaluate(() => ({
        gateError: window.AppState && window.AppState.circlesGateError,
      }));
      expect(state.gateError).not.toBe('DRAFT_CREATE_FAILED');
    } finally {
      await cleanupSession(page, sid);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC2 — Exhaust: POST /draft sustained 503 → RetryExhausted → DRAFT_CREATE_FAILED
  // banner visible + "重新嘗試" button visible.
  // ───────────────────────────────────────────────────────────────────────────
  test('TC2 exhaust: sustained 503 → DRAFT_CREATE_FAILED banner + 重新嘗試 button', async ({ page }, testInfo) => {
    let countingEnabled = false;
    let draftAttempts = 0;

    await bootToPhase1Drill(page, projectQuestionBase(testInfo) + 1, async (pg) => {
      await pg.route('**/api/circles-sessions/draft', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        if (countingEnabled) draftAttempts++;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service Unavailable (T4 TC2 sustained fault)' }),
        });
      });
    });

    countingEnabled = true;

    try {
      await fireGateBypassingValidator(page);

      // Wait for error-wrap to render (persistRetry exhausts ~1.75s + UI render).
      await page.locator('.gate-content > .error-wrap').waitFor({ state: 'visible', timeout: 15_000 });

      // Assert DRAFT_CREATE_FAILED error code shown.
      const errorCode = await page.locator('.error-wrap__code').textContent();
      expect(errorCode).toBe('DRAFT_CREATE_FAILED');

      // Assert zh-TW message present (spec §5.3).
      const errorSub = await page.locator('.error-wrap__sub').textContent();
      expect(errorSub).toContain('無法建立練習');

      const errorTitle = await page.locator('.error-wrap__title').textContent();
      expect(errorTitle).toContain('建立練習失敗');

      // Assert "重新嘗試" button present + visible + clickable.
      const retryBtn = page.locator('[data-gate-action="retry"]');
      await expect(retryBtn).toBeVisible();
      const retryText = await retryBtn.textContent();
      expect(retryText).toContain('重新嘗試');

      // Verify retry math: persistRetry default maxAttempts=4 → 4 POST attempts fired.
      expect(draftAttempts, 'Expected 4 POST /draft attempts (persistRetry maxAttempts=4)').toBe(4);

      // AppState invariants on exhaust:
      const state = await page.evaluate(() => ({
        gateError: window.AppState && window.AppState.circlesGateError,
        gateLoading: window.AppState && window.AppState.circlesGateLoading,
        gateResult: window.AppState && window.AppState.circlesGateResult,
        session: window.AppState && window.AppState.circlesSession,
      }));
      expect(state.gateError).toBe('DRAFT_CREATE_FAILED');
      expect(state.gateLoading).toBe(false);
      expect(state.gateResult).toBeNull();
      expect(state.session, 'no session created on exhaust').toBeNull();

      // Proceed button must NOT exist on error variant.
      const proceedCount = await page.locator('[data-gate-action="proceed"]').count();
      expect(proceedCount).toBe(0);
    } finally {
      // No sid to clean — exhaust never created a row.
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC3 — Click "重新嘗試" after exhaust → fresh retry chain fires (4 more POSTs).
  // Validates the existing data-gate-action="retry" handler invokes
  // submitFrameworkToGate, which re-enters persistRetry with a fresh chain.
  // ───────────────────────────────────────────────────────────────────────────
  test('TC3 retry-click: 重新嘗試 button re-fires retry chain (4 more attempts)', async ({ page }, testInfo) => {
    let countingEnabled = false;
    let draftAttempts = 0;

    await bootToPhase1Drill(page, projectQuestionBase(testInfo) + 2, async (pg) => {
      await pg.route('**/api/circles-sessions/draft', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        if (countingEnabled) draftAttempts++;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service Unavailable (T4 TC3 sustained fault)' }),
        });
      });
    });

    countingEnabled = true;

    try {
      // Round 1: first exhaust → 4 attempts → banner.
      await fireGateBypassingValidator(page);
      await page.locator('.gate-content > .error-wrap').waitFor({ state: 'visible', timeout: 15_000 });
      expect(draftAttempts, 'Round 1: expected 4 attempts after first exhaust').toBe(4);

      // Round 2: click 重新嘗試 → fresh persistRetry chain → 4 more attempts.
      // submitFrameworkToGate is re-entered; gateInflight mutex was released in
      // its outer finally so the second invocation can proceed.
      const retryBtn = page.locator('[data-gate-action="retry"]');
      await expect(retryBtn).toBeVisible();
      await retryBtn.click();

      // Wait for the second exhaust cycle to complete — draftAttempts should
      // reach 8 (4 from round 1 + 4 from round 2). Web-first polling assertion
      // (common-pitfalls.md Pitfall 1: no waitForTimeout).
      await expect.poll(
        () => draftAttempts,
        { message: 'expected 8 total POST /draft attempts after retry-click (4 + 4)', timeout: 15_000 }
      ).toBe(8);

      // Banner still present after second exhaust.
      await expect(page.locator('.gate-content > .error-wrap')).toBeVisible();
      const errorCode = await page.locator('.error-wrap__code').textContent();
      expect(errorCode).toBe('DRAFT_CREATE_FAILED');

      // AppState: still no session, still DRAFT_CREATE_FAILED.
      const state = await page.evaluate(() => ({
        gateError: window.AppState && window.AppState.circlesGateError,
        session: window.AppState && window.AppState.circlesSession,
      }));
      expect(state.gateError).toBe('DRAFT_CREATE_FAILED');
      expect(state.session, 'no session created across both exhaust cycles').toBeNull();
    } finally {
      // No sid to clean — exhaust never created a row.
    }
  });

});
