// tests/e2e/circles-phase2-evaluator-error-shown.spec.js
//
// F-CT1.2 — CIRCLES Phase 2 結論送出 evaluator 失敗靜默吞修復驗證。
//
// Root cause (app.js):
//   Bug A (line 7136): `fetch(...)` → 跳過 window.apiFetch 401 refresh+retry
//   Bug B (lines 7157-7161): evalRes.ok===false only re-enables button,
//     不設 AppState.circlesPhase3Error → 用戶完全不知道評分失敗
//
// Skill citations:
//   network-mocking.md 839-933   — page.route 503/401 on evaluate-step (Pitfall 11 carve-out)
//   common-pitfalls.md Pitfall 11 — own API NOT mocked except error simulation
//   common-pitfalls.md Pitfall 14 — test-local mutable state (hitCount) NOT module-level
//   common-pitfalls.md Pitfall 18 — page.evaluate AppState read-back
//   common-pitfalls.md Pitfall 19 — test.step() per scenario phase
//   common-pitfalls.md Pitfall 3  — role-based / data-attr locators
//   authentication.md 29-70      — storageState reuse from auth.setup.js
//   §3.7 storageState             — test.use per describe block
//   §3.11 cross-vp 3 projects    — testMatch added to playwright.config.js
//   §3.18 5x consecutive          — repeat CLI gate

'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');

const AUTH_FILE = path.join(__dirname, '..', '..', 'playwright', '.auth', 'user.json');

// ── helpers ───────────────────────────────────────────────────────────────────

async function bootApp(page) {
  // Pitfall 14: clear localStorage in initScript (no module-level state)
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });

  // Stub list endpoints so home loads fast without real sessions
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
}

async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

async function seedCirclesSession(page) {
  // Wait for CIRCLES_QUESTIONS to be available
  await page.waitForFunction(
    () => window.CIRCLES_QUESTIONS && window.CIRCLES_QUESTIONS.length > 0,
    { timeout: 10_000 }
  );
  const id = await page.evaluate(async () => {
    const q = window.CIRCLES_QUESTIONS[0];
    const res = await window.apiFetch('/api/circles-sessions/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: q.id, mode: 'drill', drill_step: 'C1' }),
    });
    if (!res.ok) throw new Error('seed failed: ' + res.status);
    const s = await res.json();
    window.AppState.circlesSession = s;
    window.AppState.circlesSelectedQuestion = q;
    return s.id;
  });
  return String(id);
}

async function deleteSession(page, sid) {
  if (!sid) return;
  try {
    await page.evaluate(async (s) => {
      try { await window.apiFetch('/api/circles-sessions/' + s, { method: 'DELETE' }); } catch (_) {}
    }, sid);
  } catch (_) {} // ignore if page already closed
}

// ── test suite ────────────────────────────────────────────────────────────────

test.describe('F-CT1.2: Phase 2 evaluator error shown + apiFetch 401 retry', () => {
  test.use({ storageState: AUTH_FILE });

  // ── AC-1: 503 from evaluate-step → error UI visible ──────────────────────

  test('AC-1: 503 on evaluate-step → circlesPhase3Error set → error UI shown with 重試 button', async ({ page }, testInfo) => {
    // Pitfall 14: hitCount is test-local, declared inside test
    let evalHitCount = 0;
    let conclusionCheckHit = 0;
    let sid = null;

    try {
      await bootApp(page);
      await waitForAuth(page);

      sid = await seedCirclesSession(page);

      await test.step('install route mocks for conclusion-check + evaluate-step', async () => {
        // Pitfall 11 carve-out: mock AI endpoints to control the test path
        // conclusion-check is an AI endpoint — mocking avoids real OpenAI call
        // Use ** to match any UUID in the session path
        await page.route(/\/api\/circles-sessions\/[^/]+\/conclusion-check$/, async (route) => {
          conclusionCheckHit++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
        });

        // network-mocking.md 839-933 pattern: force 503 on evaluate-step
        // Using broad pattern to catch all evaluate-step calls
        await page.route(/evaluate-step/, async (route) => {
          evalHitCount++;
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'server_error', code: 'EVAL_API_ERROR' }),
          });
        });
      });

      await test.step('inject Phase 2 conclusion-mode state + render', async () => {
        await page.evaluate((sId) => {
          const A = window.AppState;
          A.circlesPhase = 2;
          A.circlesMode = 'drill';
          A.circlesDrillStep = 'C1';
          A.circlesConversation = [
            { role: 'coach', text: '請描述目標用戶與核心問題。', hint: null, example: null },
            { role: 'user',  text: '中小型電商賣家面臨庫存預測不準確的問題，導致積壓或缺貨，影響收入。' },
            { role: 'coach', text: '很好！請整理結論。', hint: null, example: null },
          ];
          // Must set session on AppState so basePath + sessionId resolves correctly
          A.circlesSession = Object.assign({}, A.circlesSession || {}, { id: sId });
          A.circlesPhase2ConclusionMode = true;
          // Draft must be >= 30 chars to enable the submit button
          A.circlesPhase2ConclusionDraft = '根據分析，目標用戶是中小型電商賣家，他們最核心的需求是準確的庫存預測工具，以改善庫存管理效率。';
          A.circlesPhase2Streaming = false;
          A.circlesPhase2StreamError = false;
          A.circlesStepScores = {};
          A.circlesScoreResult = null;
          A.circlesPhase3Error = null;
          A.circlesPhase3LoadingStep = 0;
          A.circlesPhase3LoadingSlow = false;
          A._phase3CoachDemoInitialized = false;
          A.view = 'circles';
          window.render();
        }, sid);

        // Wait for the submit button to be visible and enabled
        const submitBtn = page.locator('[data-phase2="conclusion-submit"]');
        await expect(submitBtn).toBeVisible({ timeout: 5_000 });
        // Ensure it's not disabled
        await expect(submitBtn).not.toBeDisabled({ timeout: 3_000 });
      });

      await test.step('click 送出結論 → conclusion-check mocked → evaluate-step 503 fires', async () => {
        await page.locator('[data-phase2="conclusion-submit"]').click();

        // Wait for evaluate-step to be called (evidenced by circlesPhase3Error being set)
        // The fix: evalRes.ok===false branch now sets circlesPhase3Error
        await page.waitForFunction(
          () => window.AppState && window.AppState.circlesPhase3Error !== null,
          { timeout: 20_000 }
        );
      });

      await test.step('after 503 — error UI visible with correct copy + retry button', async () => {
        // Phase 3 error view renders when circlesPhase3Error is set (renderPhase3Error)
        const errorWrap = page.locator('.error-wrap').first();
        await expect(errorWrap).toBeVisible({ timeout: 5_000 });

        // Title must contain 評分 (evaluation-related error copy per renderPhase3Error)
        const titleEl = page.locator('.error-wrap__title').first();
        await expect(titleEl).toBeVisible({ timeout: 3_000 });
        const titleText = await titleEl.textContent();
        expect(titleText).toMatch(/評分/);

        // Retry button visible (Pitfall 3: data-attr locator)
        const retryBtn = page.locator('[data-phase3="retry"]').first();
        await expect(retryBtn).toBeVisible({ timeout: 3_000 });

        // AppState check (Pitfall 18)
        const errState = await page.evaluate(() => window.AppState.circlesPhase3Error);
        expect(errState).not.toBeNull();
        expect(errState.code).toMatch(/EVAL_/);

        // Verify conclusion-check was mocked (not real OpenAI)
        expect(conclusionCheckHit).toBeGreaterThanOrEqual(1);
        // Verify evaluate-step was called and intercepted
        expect(evalHitCount).toBeGreaterThanOrEqual(1);
      });

      // PNG evidence
      await page.screenshot({
        path: `audit/F-CT1.2-evidence/error-ui-shown-${testInfo.project.name}.png`,
        fullPage: false,
      });

    } finally {
      await deleteSession(page, sid);
    }
  });

  // ── AC-2: apiFetch 401 → refreshSession → retry → 200 OK (no kick-to-login) ──

  test('AC-2: 401 on evaluate-step → apiFetch refreshes token → retry succeeds → score result set', async ({ page }, testInfo) => {
    // Pitfall 14: test-local counters
    let evalHitCount = 0;
    let firstBearer = null;
    let retryBearer = null;
    let sid = null;

    try {
      await bootApp(page);
      await waitForAuth(page);

      sid = await seedCirclesSession(page);

      // Capture initial token before mocking
      const initialToken = await page.evaluate(() => window.AppState.accessToken);
      expect(initialToken).toBeTruthy();

      await test.step('install route mocks', async () => {
        // Pitfall 11 carve-out: mock conclusion-check (AI endpoint)
        await page.route('**/api/circles-sessions/*/conclusion-check', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
        });

        // network-mocking.md 839-933 intermittent failure pattern:
        // First POST → 401, second POST → 200 with mock score
        await page.route(/evaluate-step/, async (route, request) => {
          if (request.method() !== 'POST') return route.continue();
          evalHitCount++;
          const bearer = (request.headers()['authorization'] || '').replace(/^Bearer\s+/i, '');
          if (evalHitCount === 1) {
            firstBearer = bearer;
            return route.fulfill({
              status: 401,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'jwt expired' }),
            });
          }
          retryBearer = bearer;
          // Return a valid score result so Phase 3 proceeds to score view
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              totalScore: 32,
              dimensions: [
                { name: '問題釐清', score: 4, maxScore: 5, feedback: '清晰' },
              ],
              coachVersion: { content: '示範答案內容。' },
            }),
          });
        });

        // Mock Supabase refresh to return a new token
        await page.route('**/auth/v1/token**', async (route, request) => {
          const url = new URL(request.url());
          if (url.searchParams.get('grant_type') !== 'refresh_token') return route.continue();
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              access_token: 'NEW.REFRESHED.JWT.for.evaluate.step',
              token_type: 'bearer',
              expires_in: 3600,
              refresh_token: 'new-refresh-token-eval',
              user: { id: 'test-user-1', email: 'e2e@first-principle.test' },
            }),
          });
        });
      });

      await test.step('inject Phase 2 conclusion-mode state + render', async () => {
        await page.evaluate((sId) => {
          const A = window.AppState;
          A.circlesPhase = 2;
          A.circlesMode = 'drill';
          A.circlesDrillStep = 'C1';
          A.circlesConversation = [
            { role: 'coach', text: '請描述目標用戶與核心問題。', hint: null, example: null },
            { role: 'user',  text: '中小型電商賣家面臨庫存預測不準確的問題，導致積壓或缺貨，影響收入。' },
            { role: 'coach', text: '很好！請整理結論。', hint: null, example: null },
          ];
          A.circlesSession = Object.assign({}, A.circlesSession || {}, { id: sId });
          A.circlesPhase2ConclusionMode = true;
          A.circlesPhase2ConclusionDraft = '根據分析，目標用戶是中小型電商賣家，他們最核心的需求是準確的庫存預測工具，以改善庫存管理效率。';
          A.circlesPhase2Streaming = false;
          A.circlesPhase2StreamError = false;
          A.circlesStepScores = {};
          A.circlesScoreResult = null;
          A.circlesPhase3Error = null;
          A.circlesPhase3LoadingStep = 0;
          A._phase3CoachDemoInitialized = false;
          A.view = 'circles';
          window.render();
        }, sid);

        const submitBtn = page.locator('[data-phase2="conclusion-submit"]');
        await expect(submitBtn).toBeVisible({ timeout: 5_000 });
        await expect(submitBtn).not.toBeDisabled({ timeout: 3_000 });
      });

      await test.step('click 送出結論 → 401 then retry with refreshed token', async () => {
        await page.locator('[data-phase2="conclusion-submit"]').click();

        // Wait for score result to be set (proves retry succeeded)
        // The fix: window.apiFetch properly retries with new token after 401
        await page.waitForFunction(
          () => window.AppState && window.AppState.circlesScoreResult !== null,
          { timeout: 20_000 }
        );
      });

      await test.step('after retry — no kick to login, score result set, 2 hits to evaluate-step', async () => {
        // evaluate-step called exactly twice (original 401 + retry)
        expect(evalHitCount).toBe(2);

        // First call used initial token
        expect(firstBearer).toBe(initialToken);

        // Retry used new refreshed token (apiFetch picked up the new token)
        expect(retryBearer).toBe('NEW.REFRESHED.JWT.for.evaluate.step');

        // NOT kicked to login (Pitfall 3: check url)
        const currentUrl = page.url();
        expect(currentUrl).not.toMatch(/auth/);

        // AppState view not 'auth'
        const view = await page.evaluate(() => window.AppState.view);
        expect(view).not.toBe('auth');

        // No error state (error should be null since retry succeeded)
        const errState = await page.evaluate(() => window.AppState.circlesPhase3Error);
        expect(errState).toBeNull();

        // Score result exists (retry returned 200)
        const scoreResult = await page.evaluate(() => window.AppState.circlesScoreResult);
        expect(scoreResult).not.toBeNull();
        expect(scoreResult.totalScore).toBe(32);
      });

      // PNG evidence
      await page.screenshot({
        path: `audit/F-CT1.2-evidence/apifetch-401-retry-${testInfo.project.name}.png`,
        fullPage: false,
      });

    } finally {
      await deleteSession(page, sid);
    }
  });
});
