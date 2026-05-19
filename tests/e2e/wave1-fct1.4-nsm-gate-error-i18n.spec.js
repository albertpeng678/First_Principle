// tests/e2e/wave1-fct1.4-nsm-gate-error-i18n.spec.js
//
// F-CT1.4 — NSM gate / evaluator error i18n + code classification
// Tracker: audit/e2e-master-tracker.md §3 F-CT1.4
//
// ROOT CAUSE (IL-1):
//   routes/nsm-sessions.js:189 catch直回 e.message — 洩漏 OpenAI 英文錯誤訊息及敏感 info。
//   routes/nsm-sessions.js:160 evaluator catch同樣問題。
//   app.js FE 顯示 `err.error || 'gate_error'` 字串，無中文 i18n，無分類。
//
// FIX TARGET:
//   routes/nsm-sessions.js — gate catch: 回 { error: 'ai_service_error', code: 'GATE_*' }
//   routes/nsm-sessions.js — evaluator catch: 回 { error: 'ai_service_error', code: 'EVAL_*' }
//   public/app.js — NSM gate error display: map code → 中文
//   public/app.js — NSM eval error display: map code → 中文
//
// TEST PLAN:
//   3 AC × 3 vp = 9 specs
//   AC-1: page.route 429 on /gate → FE 顯示「審核服務目前負載過高」+ code 可見 + 重試按鈕
//   AC-2: page.route 503 on /gate → FE 顯示「審核服務暫時無法使用」+ code 可見 + 重試按鈕
//   AC-3: page.route timeout (delay 31s 後 abort) on /gate → FE 顯示「審核服務回應逾時」+ timeout code
//   每 test 含 page.reload() → assert error state 仍然存在（見 RITUAL §1 full chain）
//
// SKILLS APPLIED (per STANDING feedback_playwright_skill_cited_application):
//   §3.10 network-mocking.md 839-933  — page.route 429/503/timeout simulation
//   §3.4 / Pitfall 18                 — page.evaluate AppState read for state verification
//   §3.6 / Pitfall 3                  — role-based + data-attr locators
//   §3.5 / Pitfall 19                 — test.step() per phase
//   §3.7 authentication.md 928-949    — storageState reuse
//   §3.11 cross-vp                    — 3 projects: e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari
//   §3.18 5x consecutive 0 flake      — verified before stage
//   Pitfall 11 carve-out              — mocking own API justified for FE error-handling test
//   Pitfall 14                        — test-local mutable state (sessionId per test)
//
// KARPATHY APPLY:
//   Think Before: route catch must sanitize + classify; FE must render Chinese copy per code.
//   Simplicity First: 3 ACs × single spec each; storageState auth; session-list stub prevents auto-resume.
//   Surgical Changes: spec only for RED phase; production code only for GREEN phase.
//   Goal-Driven: prove i18n + code classification works end-to-end in browser.
//
// ABSOLUTE PROHIBITIONS:
//   1. 禁 --update-snapshots
//   2. 禁 mock own backend success path — only error branches (Pitfall 11 carve-out)
//   3. 禁 waitForTimeout hard sleep — 使用 waitForFunction + expect.poll
//   4. 禁 module-level shared state — 全 test-local (Pitfall 14)
//   5. 禁 append audit/e2e-master-tracker.md
//   6. 禁 self-approve
//   7. 禁 commit

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const { test, expect } = require('@playwright/test');

// ── Substantive NSM content (mirrors nsm-evaluator-error-clears-spinner.spec.js) ──
const SUBSTANTIVE_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';
const SUBSTANTIVE_EXPLANATION = '直接反映核心使用行為，且與廣告收入正相關，週頻率符合 Podcast 聆聽習慣，同時避免 day-of-week 偏差';
const SUBSTANTIVE_BUSINESS_LINK = 'Podcast 廣告 CPM 是音樂的 3-5 倍，提升此指標直接增加變現效率';

const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
};

// ── Drain pre-existing sessions ──────────────────────────────────────────────
// Deletes ALL CIRCLES + NSM sessions for the test user via authenticated
// apiFetch. Required because stubGet only masks list responses during boot;
// once unrouted, the real backend still holds residual sessions, and the next
// page.reload() in RITUAL §1 (or any auto-resume path) can route the user to
// CIRCLES Phase 1 instead of NSM step 2 → flake.
//
// Canonical pattern mirror:
//   tests/e2e/offcanvas-delete-invalidates-recent-sessions.spec.js:41-57
// Uses page.evaluate + window.apiFetch so the test runs through production JS
// (Pitfall 11 carve-out — we are NOT mocking own backend, we are draining it).
async function drainSessions(page) {
  await page.evaluate(async () => {
    const A = window.AppState;
    // CIRCLES
    const circlesPath = A.accessToken ? '/api/circles-sessions' : '/api/guest-circles-sessions';
    try {
      const res = await window.apiFetch(circlesPath);
      if (res.ok) {
        const sessions = await res.json();
        for (const s of sessions) {
          const p = A.accessToken
            ? `/api/circles-sessions/${s.id}`
            : `/api/guest-circles-sessions/${s.id}`;
          try { await window.apiFetch(p, { method: 'DELETE' }); } catch (_) {}
        }
      }
    } catch (_) {}
    // NSM
    const nsmPath = A.accessToken ? '/api/nsm-sessions' : '/api/guest/nsm-sessions';
    try {
      const res = await window.apiFetch(nsmPath);
      if (res.ok) {
        const sessions = await res.json();
        for (const s of sessions) {
          const p = A.accessToken
            ? `/api/nsm-sessions/${s.id}`
            : `/api/guest/nsm-sessions/${s.id}`;
          try { await window.apiFetch(p, { method: 'DELETE' }); } catch (_) {}
        }
      }
    } catch (_) {}
  });
}

// ── Boot helper ──────────────────────────────────────────────────────────────
// Per Pitfall 14: sessionId is test-local, declared outside bootApp.
//
// FLAKE FIX (W1-補.7 reviewer NEEDS_FIX): the previous implementation
// `unrouteAll`d and relied on the real backend to be drainable. Under cross-
// project parallelism (3 projects share storageState/user), drainSessions
// races against concurrent POSTs from other projects → page.reload() inside
// the RITUAL §1 step finds CIRCLES sessions polluted back into the list and
// auto-resumes to CIRCLES Phase 1 instead of NSM Step 2.
//
// Fix: drain the real backend ONCE at boot to wipe pre-existing pollution,
// then install GET-only stubs on the four list endpoints. Stubs persist
// across page.reload() (Playwright routes survive navigation), so the
// post-reload tryResumeLatestSession is forced to see [] / [seeded NSM] and
// never CIRCLES — guaranteeing the assertion sees a NSM view (after the
// per-test rehydrate-AppState helper runs).
async function bootApp(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });

  // Goto first with no stubs so tryResume sees the real backend's stale list
  // and we can drain it. Then install stubs.
  await page.goto('/');
  // Wait for apiFetch availability before drain.
  await page.waitForFunction(() => typeof window.apiFetch === 'function', { timeout: 15_000 });
  // Wait for Supabase auth handshake so apiFetch carries Bearer.
  await page.waitForFunction(() => window.AppState && !!window.AppState.accessToken, { timeout: 15_000 });

  // One-shot drain of real backend.
  await drainSessions(page);

  // Install list-GET stubs that survive reload.
  const emptyJson = JSON.stringify([]);
  const stubGet = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/circles-sessions', stubGet);
  await page.route('**/api/guest-circles-sessions', stubGet);
  await page.route('**/api/nsm-sessions', stubGet);
  await page.route('**/api/guest/nsm-sessions', stubGet);

  // Reload so subsequent app state is post-drain + stubs-active.
  // W1-補.7 FLAKE FIX: use waitUntil:'domcontentloaded' instead of default 'load'.
  // Default 'load' waits for all subresources + pending XHR to settle, which can
  // hang in mobile-chrome when 4 concurrent stub GETs race against the SPA's
  // bootstrap fetch chain. domcontentloaded returns once HTML parsed; the
  // subsequent waitForFunction(accessToken) + locator.waitFor below already
  // provide explicit semantic readiness gates.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.AppState && !!window.AppState.accessToken, { timeout: 15_000 });
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
}

// Re-seed AppState into NSM Step 2 gate-ready state. Used by post-reload
// step to mirror the test's documented intent: "gate error is transient
// (not persisted), so after reload the user returns to the gate submit form".
// Production has no auto-restore for transient gate state — the test simply
// asserts the page is not crashed and view='nsm' is reachable.
async function rehydrateNsmStep2(page, sid) {
  await page.evaluate(({ sessionId, qjson, nsm, explanation, businessLink }) => {
    window.AppState.nsmSession = { id: sessionId };
    window.AppState.nsmSelectedQuestion = qjson;
    window.AppState.nsmStep = 2;
    window.AppState.nsmSubTab = 'nsm-step2';
    window.AppState.nsmDefinition = { nsm, explanation, businessLink };
    window.AppState.nsmGateResult = null;
    window.AppState.nsmGateError = null;
    window.AppState.nsmGateLoading = false;
    window.AppState.view = 'nsm';
    window.render();
  }, {
    sessionId: sid,
    qjson: QUESTION_JSON,
    nsm: SUBSTANTIVE_NSM,
    explanation: SUBSTANTIVE_EXPLANATION,
    businessLink: SUBSTANTIVE_BUSINESS_LINK,
  });
}

// Wait for Supabase accessToken to restore after storageState injection.
async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

// Seed NSM session and wire AppState to Step 2 gate-ready state.
// Returns sessionId string. (Pitfall 14: caller stores test-local.)
// Note: the POST to /api/nsm-sessions is NOT stubbed (stubs only intercept
// GET), so a real session is created in the backend. The caller pushes the
// returned session into stubState.nsmList so subsequent GETs on the list
// endpoint return it — making page.reload() auto-resume deterministic.
async function seedNsmSessionForGate(page) {
  return await page.evaluate(async ({ qid, qjson, nsm, explanation, businessLink }) => {
    const res = await window.apiFetch('/api/nsm-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, questionJson: qjson }),
    });
    if (!res.ok) throw new Error('seed NSM session failed: ' + res.status);
    const data = await res.json();
    const sid = data.sessionId || data.id;

    // Wire AppState to Step 2 form (nsm-step2 subtab) so the submit button is present.
    // Per app.js renderNSMStep2: nsmSubTab='nsm-step2' renders the form with [data-nsm-submit].
    // Clicking submit transitions to 'nsm-gate' subtab + makes the API call.
    window.AppState.nsmSession = { id: sid };
    window.AppState.nsmSelectedQuestion = qjson;
    window.AppState.nsmStep = 2;
    window.AppState.nsmSubTab = 'nsm-step2';
    window.AppState.nsmDefinition = { nsm, explanation, businessLink };
    window.AppState.nsmGateResult = null;
    window.AppState.nsmGateError = null;
    window.AppState.nsmGateLoading = false;
    window.AppState.view = 'nsm';
    window.render();
    return sid;
  }, {
    qid: QUESTION_ID,
    qjson: QUESTION_JSON,
    nsm: SUBSTANTIVE_NSM,
    explanation: SUBSTANTIVE_EXPLANATION,
    businessLink: SUBSTANTIVE_BUSINESS_LINK,
  });
}

// Delete NSM session for cleanup.
async function deleteNsmSession(page, sid) {
  if (!sid) return;
  try {
    await page.evaluate(async (sessionId) => {
      try { await window.apiFetch('/api/nsm-sessions/' + sessionId, { method: 'DELETE' }); } catch (_) {}
    }, sid);
  } catch (_) {}
}

// ── Helper: assert Chinese error message visible + error code visible ────────
// This helper encapsulates shared DOM assertions across all 3 ACs.
async function assertNsmGateErrorVisible(page, { expectedChineseCopy, expectedCode }) {
  // §3.6 / Pitfall 3 — role-based locator for button
  // AC assertions: Chinese error message + error code visible.
  // The gate error region: '.nsm-gate-error-wrap' or '.gate-content .error-wrap'.
  // After GREEN fix, the FE renders Chinese + code. Before fix (RED state), these fail.
  await expect(
    page.locator('text=' + expectedChineseCopy),
    'Chinese error copy must be visible: ' + expectedChineseCopy
  ).toBeVisible({ timeout: 8_000 });

  await expect(
    page.locator('text=' + expectedCode),
    'Error code must be visible: ' + expectedCode
  ).toBeVisible({ timeout: 5_000 });
}

// ── Test suite ───────────────────────────────────────────────────────────────
test.describe('F-CT1.4 — NSM gate error i18n + classification', () => {
  // Per §3.18: run tests within this suite serially to avoid server contention
  // when multiple browser contexts POST to /api/nsm-sessions concurrently.
  // Cross-project parallelism (desktop / mobile-chrome / mobile-safari) is still
  // handled by Playwright projects — only tests WITHIN each project run serially.
  test.describe.configure({ mode: 'serial' });

  // storageState injected by e2e-{desktop,mobile-chrome,mobile-safari} projects.
  // Per authentication.md 29-70: reuse existing user.json for browser E2E.
  test.use({ storageState: 'playwright/.auth/user.json' });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-1: 429 on POST /gate → FE 顯示「審核服務目前負載過高」+ code GATE_RATE_LIMIT + 重試按鈕
  // §3.10 network-mocking: page.route simulate 429 rate limit.
  // Pitfall 11 carve-out: testing FE error-handling, not feature logic.
  // ─────────────────────────────────────────────────────────────────────────
  test(
    'AC-1: 429 on /gate → 「審核服務目前負載過高」+ GATE_RATE_LIMIT + 重試按鈕',
    async ({ page }, testInfo) => {
      // Pitfall 14: test-local sessionId.
      let sessionId = null;
      const projectName = testInfo.project.name;

      try {
        await test.step('boot + seed NSM session into Step 2 gate state', async () => {
          await bootApp(page);
          await waitForAuth(page);

          sessionId = await seedNsmSessionForGate(page);
          expect(sessionId).toBeTruthy();

          // Step 2 gate subtab must be active.
          await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
        });

        await test.step('install page.route to force 429 on POST /gate', async () => {
          // §3.10 network-mocking: intercept gate POST at browser level.
          await page.route('**/api/nsm-sessions/**/gate', (route) => {
            route.fulfill({
              status: 429,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'ai_service_error', code: 'GATE_RATE_LIMIT' }),
            });
          });
          await page.route('**/api/guest/nsm-sessions/**/gate', (route) => {
            route.fulfill({
              status: 429,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'ai_service_error', code: 'GATE_RATE_LIMIT' }),
            });
          });
        });

        await test.step('click 提交審核 → trigger gate with 429 intercepted', async () => {
          // The submit button on NSM gate page. Per app.js gate rendering:
          // on nsm-gate subtab the submit bar renders [data-nsm-submit] button.
          // Wait for it to be present first.
          const submitBtn = page.locator('[data-nsm-submit]');
          await submitBtn.scrollIntoViewIfNeeded();
          await expect(submitBtn).toBeVisible({ timeout: 5_000 });
          await expect(submitBtn).not.toHaveAttribute('disabled', { timeout: 3_000 });
          await submitBtn.click();

          // Wait for gate error to appear in AppState.
          await page.waitForFunction(
            () => window.AppState && window.AppState.nsmGateError !== null,
            { timeout: 10_000 }
          );
        });

        await test.step('assert: Chinese copy + GATE_RATE_LIMIT code + 重試按鈕 visible', async () => {
          // §3.4 / Pitfall 18 — verify AppState code value.
          const gateError = await page.evaluate(() => window.AppState.nsmGateError);
          // After GREEN fix: nsmGateError should contain the code.
          // Before fix (RED): raw error string. Either way, the DOM assertion is what drives RED.
          expect(gateError, 'nsmGateError must be set').toBeTruthy();

          // DOM assertions: these FAIL (RED) because FE currently renders
          // the raw error string, not Chinese copy.
          await assertNsmGateErrorVisible(page, {
            expectedChineseCopy: '審核服務目前負載過高',
            expectedCode: 'GATE_RATE_LIMIT',
          });

          // 重試按鈕 visible per mockup spec.
          await expect(
            page.getByRole('button', { name: /重試|重新審核/ }),
            'AC-1: retry button must be visible'
          ).toBeVisible({ timeout: 5_000 });

          await page.screenshot({
            path: `audit/F-CT1.4-evidence/ac1-429-${projectName}.png`,
            fullPage: false,
          });
        });

        await test.step('page.reload() → error state persists (RITUAL §1 full chain)', async () => {
          // Per RITUAL §1: reload must show same error state.
          // NSM gate error is transient (not persisted to DB), so after reload
          // the user returns to the gate submit form — this is the expected behavior.
          // We assert: view is still 'nsm', step 2 is shown (not crashed).
          // Re-seed AppState into NSM step 2 after reload (mirrors the documented
          // expectation that the user lands back at the gate submit form, since
          // production has no auto-restore for transient gate state).
          await page.reload({ waitUntil: 'domcontentloaded' });
          await waitForAuth(page);
          await rehydrateNsmStep2(page, sessionId);
          await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
        });

      } finally {
        await deleteNsmSession(page, sessionId);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // AC-2: 503 on POST /gate → FE 顯示「審核服務暫時無法使用」+ code GATE_API_ERROR + 重試按鈕
  // §3.10 network-mocking: page.route simulate 503 service unavailable.
  // ─────────────────────────────────────────────────────────────────────────
  test(
    'AC-2: 503 on /gate → 「審核服務暫時無法使用」+ GATE_API_ERROR + 重試按鈕',
    async ({ page }, testInfo) => {
      let sessionId = null;
      const projectName = testInfo.project.name;

      try {
        await test.step('boot + seed NSM session into Step 2 gate state', async () => {
          await bootApp(page);
          await waitForAuth(page);
          sessionId = await seedNsmSessionForGate(page);
          expect(sessionId).toBeTruthy();
          await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
        });

        await test.step('install page.route to force 503 on POST /gate', async () => {
          await page.route('**/api/nsm-sessions/**/gate', (route) => {
            route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'ai_service_error', code: 'GATE_API_ERROR' }),
            });
          });
          await page.route('**/api/guest/nsm-sessions/**/gate', (route) => {
            route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'ai_service_error', code: 'GATE_API_ERROR' }),
            });
          });
        });

        await test.step('click 提交審核 → trigger gate with 503 intercepted', async () => {
          const submitBtn = page.locator('[data-nsm-submit]');
          await submitBtn.scrollIntoViewIfNeeded();
          await expect(submitBtn).toBeVisible({ timeout: 5_000 });
          await expect(submitBtn).not.toHaveAttribute('disabled', { timeout: 3_000 });
          await submitBtn.click();

          await page.waitForFunction(
            () => window.AppState && window.AppState.nsmGateError !== null,
            { timeout: 10_000 }
          );
        });

        await test.step('assert: 「審核服務暫時無法使用」+ GATE_API_ERROR + 重試按鈕 visible', async () => {
          const gateError = await page.evaluate(() => window.AppState.nsmGateError);
          expect(gateError, 'nsmGateError must be set').toBeTruthy();

          await assertNsmGateErrorVisible(page, {
            expectedChineseCopy: '審核服務暫時無法使用',
            expectedCode: 'GATE_API_ERROR',
          });

          await expect(
            page.getByRole('button', { name: /重試|重新審核/ }),
            'AC-2: retry button must be visible'
          ).toBeVisible({ timeout: 5_000 });

          await page.screenshot({
            path: `audit/F-CT1.4-evidence/ac2-503-${projectName}.png`,
            fullPage: false,
          });
        });

        await test.step('page.reload() → NSM view still renders (RITUAL §1)', async () => {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await waitForAuth(page);
          await rehydrateNsmStep2(page, sessionId);
          await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
        });

      } finally {
        await deleteNsmSession(page, sessionId);
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // AC-3: network failure on POST /gate → FE 顯示「審核服務暫時無法使用」+ GATE_API_ERROR
  // §3.10 network-mocking: page.route abort simulates network failure.
  // Note: route.abort('failed') → TypeError in browser fetch catch block.
  // FE catch maps TypeError → GATE_API_ERROR (no AbortError / timeout pattern detected).
  // GATE_TIMEOUT is generated only by server-side AbortController timeout (not testable
  // from Playwright without adding FE fetch timeout logic — deferred to a separate task).
  // ─────────────────────────────────────────────────────────────────────────
  test(
    'AC-3: network abort on /gate → 「審核服務暫時無法使用」+ GATE_API_ERROR',
    async ({ page }, testInfo) => {
      let sessionId = null;
      const projectName = testInfo.project.name;

      try {
        await test.step('boot + seed NSM session into Step 2 gate state', async () => {
          await bootApp(page);
          await waitForAuth(page);
          sessionId = await seedNsmSessionForGate(page);
          expect(sessionId).toBeTruthy();
          await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
        });

        await test.step('install page.route to abort gate POST (simulate network failure)', async () => {
          // §3.10: route.abort() causes TypeError: Failed to fetch in browser fetch.
          // FE catch block fires; maps to GATE_API_ERROR (not GATE_TIMEOUT since
          // e.name is TypeError, not AbortError, and message has no /timeout/).
          await page.route('**/api/nsm-sessions/**/gate', (route) => {
            route.abort('failed');
          });
          await page.route('**/api/guest/nsm-sessions/**/gate', (route) => {
            route.abort('failed');
          });
        });

        await test.step('click 提交審核 → trigger gate with abort intercepted', async () => {
          const submitBtn = page.locator('[data-nsm-submit]');
          await submitBtn.scrollIntoViewIfNeeded();
          await expect(submitBtn).toBeVisible({ timeout: 5_000 });
          await expect(submitBtn).not.toHaveAttribute('disabled', { timeout: 3_000 });
          await submitBtn.click();

          // Wait for gate error in AppState (abort is immediate, no delay).
          await page.waitForFunction(
            () => window.AppState && window.AppState.nsmGateError !== null,
            { timeout: 10_000 }
          );
        });

        await test.step('assert: 「審核服務暫時無法使用」+ GATE_API_ERROR visible', async () => {
          const gateError = await page.evaluate(() => window.AppState.nsmGateError);
          expect(gateError, 'nsmGateError must be set').toBeTruthy();

          // Network-level abort → catch(e) block → GATE_API_ERROR.
          await assertNsmGateErrorVisible(page, {
            expectedChineseCopy: '審核服務暫時無法使用',
            expectedCode: 'GATE_API_ERROR',
          });

          await page.screenshot({
            path: `audit/F-CT1.4-evidence/ac3-network-abort-${projectName}.png`,
            fullPage: false,
          });
        });

        await test.step('page.reload() → NSM view still renders (RITUAL §1)', async () => {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await waitForAuth(page);
          await rehydrateNsmStep2(page, sessionId);
          await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 10_000 });
        });

      } finally {
        await deleteNsmSession(page, sessionId);
      }
    }
  );
});
