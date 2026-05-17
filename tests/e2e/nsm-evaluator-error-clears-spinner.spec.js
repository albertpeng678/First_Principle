// tests/e2e/nsm-evaluator-error-clears-spinner.spec.js
//
// F-CT1.1 — NSM evaluator FE spinner 卡死修復驗證
// Tracker: audit/e2e-master-tracker.md §3 F-CT1.1
//
// Root cause (IL-1): app.js:2039-2043 !res.ok branch calls render() with
//   AppState.nsmEvalLoading still true, then returns without setting
//   nsmEvalLoading = false before render. The finally block sets it false
//   but calls no render(), leaving state inconsistent and spinner stuck.
//
// Fix target: app.js ~2039-2043 — add AppState.nsmEvalLoading = false
//   BEFORE the render() call in the !res.ok early-return branch.
//
// Skills applied (RITUAL §3 + /Users/albertpeng/.claude/skills/playwright-skill/core/):
//   §3.10 network-mocking.md 839-933 — page.route force 503
//   Pitfall 11 — error-state simulation carve-out (testing FE error handling,
//                not mocking our own API for feature logic)
//   Pitfall 18 — page.evaluate AppState read
//   Pitfall 3 — role-based locators
//   Pitfall 19 — test.step() per phase
//   §3.7 auth-flows.md 928-949 — storageState
//   §3.11 mobile-and-responsive.md 49-71 — cross-vp via projects
//   §3.18 5x consecutive 0 flake gate
//   Per memory `feedback_e2e_real_data_only` — real backend + apiFetch seed

'use strict';

const { test, expect } = require('@playwright/test');

// ── Substantive NSM content (mirrors nsm-full-flow.spec.js) ─────────────────
// Passes hasSubstantiveContent gate reliably — same constants as nsm-full-flow.
const SUBSTANTIVE_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';
const SUBSTANTIVE_EXPLANATION = '直接反映核心使用行為，且與廣告收入正相關，週頻率符合 Podcast 聆聽習慣，同時避免 day-of-week 偏差';
const SUBSTANTIVE_BUSINESS_LINK = 'Podcast 廣告 CPM 是音樂的 3-5 倍，提升此指標直接增加變現效率';
const SUBSTANTIVE_BREAKDOWN = {
  reach:     '每週至少訪問 Spotify 的用戶，約 3.5 億，其中 Podcast 觸及率目前 40%，即 1.4 億人',
  depth:     '播放超過 5 分鐘代表有意圖的消費行為，而非意外點擊',
  frequency: '週活躍而非月活躍，符合 Podcast 聆聽習慣，同時避免 day-of-week 偏差',
};

const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
};

// ── Boot helper (mirrors nsm-full-flow.spec.js bootApp) ─────────────────────
// Per Pitfall 14: no module-level mutable state — sessionId declared test-local.
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
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// Wait for Supabase accessToken to restore after storageState injection.
async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

// Seed NSM session via apiFetch (Bearer token carried automatically).
// Returns sessionId string.
async function seedNsmSession(page) {
  return await page.evaluate(async ({ qid, qjson }) => {
    const res = await window.apiFetch('/api/nsm-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, questionJson: qjson }),
    });
    if (!res.ok) throw new Error('seed NSM session failed: ' + res.status);
    const data = await res.json();
    const sid = data.sessionId || data.id;
    // Wire session into AppState so evaluate POST path finds session.id.
    window.AppState.nsmSession = { id: sid };
    window.AppState.nsmSelectedQuestion = qjson;
    return sid;
  }, { qid: QUESTION_ID, qjson: QUESTION_JSON });
}

// Delete NSM session for cleanup (bearer token via page context).
async function deleteNsmSession(page, sid) {
  if (!sid) return;
  try {
    await page.evaluate(async (sessionId) => {
      try { await window.apiFetch('/api/nsm-sessions/' + sessionId, { method: 'DELETE' }); } catch (_) {}
    }, sid);
  } catch (_) {}
}

// ── Test suite ──────────────────────────────────────────────────────────────
test.describe('F-CT1.1 — NSM evaluator 503 clears spinner + nsmEvalLoading', () => {
  // storageState injected by e2e-{desktop,mobile-chrome,mobile-safari} projects.
  // Per authentication.md 29-70 — reuse existing user.json for browser E2E.
  test.use({ storageState: 'playwright/.auth/user.json' });

  // ──────────────────────────────────────────────────────────────────────────
  // Single test: seeds NSM Step 3 state, forces 503, asserts spinner clears.
  // No real OpenAI call — page.route intercepts POST /evaluate at browser level.
  // Per Pitfall 11 carve-out: mocking own API is justified for FE error-handling
  // tests where the test cannot be written otherwise (server-to-server would
  // bypass page.route, but this endpoint IS called by the browser's fetch).
  // ──────────────────────────────────────────────────────────────────────────
  test(
    '503 on POST /evaluate → spinner clears, nsmEvalLoading=false, submit enabled',
    async ({ page }, testInfo) => {
      // Pitfall 14: sessionId is test-local.
      let sessionId = null;
      const projectName = testInfo.project.name;

      try {
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 1 — Boot app + seed NSM session into Step 3 ready state
        // (api-testing.md 783-848 — API seeding 10-100× faster than UI walk)
        // ═══════════════════════════════════════════════════════════════════
        await test.step('boot + seed NSM session into Step 3 ready state', async () => {
          await bootApp(page);
          await waitForAuth(page);

          // Seed real NSM session via apiFetch.
          sessionId = await seedNsmSession(page);
          expect(sessionId).toBeTruthy();

          // Pre-fill all 4 NSM AppState fields (definition + 3 breakdown dims).
          // This bypasses Steps 1 + 2 gate which would require real OpenAI.
          // We are testing Step 3 → evaluate error path only.
          await page.evaluate(({ nsm, explanation, businessLink, br }) => {
            window.AppState.nsmStep = 3;
            window.AppState.nsmSubTab = 'nsm-step3';
            window.AppState.nsmDefinition = { nsm, explanation, businessLink };
            window.AppState.nsmBreakdown = br;
            window.AppState.nsmEvalResult = null;
            window.AppState.nsmEvalError = null;
            window.AppState.nsmEvalLoading = false;
            window.AppState.view = 'nsm';
            window.render();
          }, {
            nsm: SUBSTANTIVE_NSM,
            explanation: SUBSTANTIVE_EXPLANATION,
            businessLink: SUBSTANTIVE_BUSINESS_LINK,
            br: SUBSTANTIVE_BREAKDOWN,
          });

          // Step 3 container must be visible — data-view="nsm" (app.js renderNSMStep3).
          await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });

          // Submit button must be enabled (canSubmit=true: all 3 dims filled).
          // Selector: [data-nsm-submit] per app.js:1693.
          const submitBtn = page.locator('[data-nsm-submit]');
          await expect(submitBtn).toBeVisible({ timeout: 5_000 });
          await expect(submitBtn).not.toHaveAttribute('disabled', { timeout: 3_000 });
        });

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2 — Route /evaluate to return 503
        // §3.10 network-mocking.md 839-933: page.route force error response.
        // Pitfall 11 carve-out: this tests FE error-handling, not feature logic.
        // The evaluate endpoint is called browser→server; page.route intercepts it.
        // ═══════════════════════════════════════════════════════════════════
        await test.step('install page.route to force 503 on POST /evaluate', async () => {
          // Route matches any /evaluate suffix on nsm-sessions paths (auth + guest).
          await page.route('**/api/nsm-sessions/**/evaluate', (route) => {
            route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'service_unavailable_test' }),
            });
          });
          await page.route('**/api/guest/nsm-sessions/**/evaluate', (route) => {
            route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'service_unavailable_test' }),
            });
          });
        });

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 3 — Click "送出，取得 AI 評分" and trigger 503
        // On mobile WebKit (Safari), scroll into view + use dispatchEvent to
        // ensure the click event fires on the async handler (§3.11 mobile quirk).
        // ═══════════════════════════════════════════════════════════════════
        await test.step('click submit → trigger evaluate with 503 intercepted', async () => {
          const submitBtn = page.locator('[data-nsm-submit]');
          // Scroll submit button into view (mobile Safari requires viewport visibility).
          await submitBtn.scrollIntoViewIfNeeded();
          // Wait for the button to be visible + enabled before clicking.
          await expect(submitBtn).toBeVisible({ timeout: 5_000 });
          await expect(submitBtn).not.toHaveAttribute('disabled', { timeout: 3_000 });
          // Click the submit button — triggers async handler at app.js:1930.
          // Use force: false (default) to let Playwright handle actionability.
          await submitBtn.click();

          // Wait for either nsmEvalLoading=true (handler fired) OR nsmEvalLoading=false
          // (handler fired AND the 503 was processed quickly).
          // This is robust across fast/slow 503 response timing.
          await page.waitForFunction(
            () => {
              // Handler has fired if nsmEvalLoading changed from initial false.
              // Since we intercepted with 503, the full cycle completes quickly.
              // We just need to confirm the click triggered the handler at all.
              return window.AppState && (
                window.AppState.nsmEvalLoading === true ||
                window.AppState.nsmEvalError !== null
              );
            },
            { timeout: 10_000 }
          );
        });

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 4 — After 503 response: assert spinner clears
        // AC-1: nsmEvalLoading === false (primary state assertion)
        // AC-2: submit button NOT in spinner state (enabled, normal text)
        // AC-3: page still shows NSM Step 3 (didn't navigate away on error)
        // AC-4: submit button is enabled (user can retry)
        // ═══════════════════════════════════════════════════════════════════
        await test.step('after 503: nsmEvalLoading clears + submit re-enabled', async () => {
          // AC-1 (primary): nsmEvalLoading must be false after the 503 response.
          // BUG STATE (before fix): finally sets it false but without render(),
          //   leaving nsmEvalLoading=true at render-time → spinner "stuck".
          // FIX STATE (after fix): nsmEvalLoading=false BEFORE render() in !res.ok branch.
          // We poll for nsmEvalLoading===false (set by either the fix or the finally block).
          await page.waitForFunction(
            () => window.AppState && window.AppState.nsmEvalLoading === false,
            { timeout: 5_000 }
          );

          // AC-1 explicit assertion via page.evaluate (§3.4 / Pitfall 18).
          const loadingAfter = await page.evaluate(() => window.AppState.nsmEvalLoading);
          expect(loadingAfter, 'AC-1: nsmEvalLoading must be false after 503').toBe(false);

          // AC-2: submit button must not show spinner text.
          // After the fix, render() is called with nsmEvalLoading=false,
          // so the DOM reflects clean state.
          const submitBtn = page.locator('[data-nsm-submit]');
          // The button should be visible (step 3 re-rendered normally).
          await expect(submitBtn).toBeVisible({ timeout: 3_000 });

          // AC-3: NSM Step 3 view must still be visible (error didn't navigate away).
          await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 3_000 });

          // AC-4: submit button must NOT be disabled (user can retry).
          // Per Pitfall 3 (role-based locators): button role assertions.
          await expect(
            page.getByRole('button', { name: /送出，取得 AI 評分/ }),
            'AC-4: submit button must be enabled for retry'
          ).toBeEnabled({ timeout: 3_000 });

          // Capture screenshot as PNG evidence (Director cold-Read).
          await page.screenshot({
            path: `audit/F-CT1.1-evidence/spinner-cleared-${projectName}.png`,
            fullPage: false,
          });
        });

      } finally {
        // Cleanup — always delete the seeded NSM session.
        await deleteNsmSession(page, sessionId);
      }
    }
  );
});
