// tests/e2e/wave1-fct1.3-circles-gate-backoff-real-flow.spec.js
//
// #3 補洞 — F-CT1.3 Playwright e2e leg:
//   CIRCLES Phase 1 submit → gate API (real OpenAI) → gate result renders → reload persists
//
// ARCHITECTURE NOTE (F-CT1.3 specific):
//   The backoff retry in circles-gate.js (800ms × attempt) is server-to-OpenAI.
//   The browser makes ONE POST to /api/circles-sessions/:id/gate; the retry loop lives
//   entirely in Node.js. We CANNOT intercept the server→OpenAI calls from Playwright.
//   The 15/15 jest unit tests (circles-gate-backoff.test.js) already verify the 800ms
//   math and the retry count. This e2e leg verifies the RITUAL §1 full chain:
//     1. Real user session → Phase 1 submit → real gate POST reaches real OpenAI
//     2. Gate result renders correctly (not stuck spinner, not GATE_API_ERROR)
//     3. DB persistence: reload → session still findable
//   Collectively: proves the backoff fix did NOT break the success path (regression guard).
//
// KARPATHY APPLY:
//   Think Before: IL-1 root cause → backoff fix must not break gate success path;
//     IL-3 TDD → e2e drives real user journey end-to-end;
//     IL-2 verification → gate result DOM visible + gateInflight cleared + sessionId persists.
//   Simplicity First: 1 test, 1 scenario; storageState auth; session-list stub prevents
//     auto-resume; gate POST goes to real backend. 3 vp via projects.
//   Surgical Changes: spec only; no production code; config testMatch extended only.
//   Goal-Driven: prove gate full-chain works after F-CT1.3 backoff patch (regression guard).
//
// SKILLS APPLIED (per STANDING feedback_playwright_skill_cited_application):
//   §3.10 network-mocking.md 839-933  — session-list GET stub (prevent auto-resume, carve-out)
//   §3.4 / Pitfall 18                 — page.evaluate AppState read for state verification
//   §3.6 / Pitfall 3                  — data-attr locators ([data-circles-phase], [data-circles="qcard"])
//   §3.5 / Pitfall 19                 — test.step() per phase for clarity
//   §3.7 authentication.md 928-949    — storageState reuse (test.use from playwright.config.js)
//   §3.11 cross-vp                    — 3 projects: e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari
//   §3.14 expect.poll / waitForResponse — no hard sleep; poll gate result DOM
//   §3.18 5x consecutive 0 flake      — verified before stage (director cross-check)
//   Pitfall 11 carve-out              — GET session-list stubs only (not gate POST = real OpenAI)
//   Pitfall 14                        — test-local mutable state (let capturedSessionId)
//
// 🚫 ABSOLUTE PROHIBITIONS (wave-1 cheat-sheet §7, line 241-249):
//   1. 禁 --update-snapshots (no visual baselines — DOM assertion only)
//   2. 禁 mock own backend success path (gate POST is REAL — Pitfall 11) — only list GET stubs
//   3. 禁 waitForTimeout hard sleep — used expect.poll + waitFor only
//   4. 禁 module-level shared state — all counters/flags are test-local (Pitfall 14)
//   5. 禁 append audit/e2e-master-tracker.md — findings go to audit/補洞-fct1.3-e2e-findings.md
//   6. 禁 self-approve — report contains git ls-files result
//   7. 禁 commit — only stage (live demo gate)

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const { test, expect } = require('@playwright/test');

// ── Valid C1 framework draft for CIRCLES Phase 1 (Drill mode, step C1) ─────────
//
// Keys match CIRCLES_STEP_CONFIG.C1.fields[*].key (Chinese keys):
//   問題範圍 (minMax: 50-120), 時間範圍 (30-100), 業務影響 (40-120), 假設確認 (30-100)
// Values are well above minimum lengths so computePhase1MinLengthBlocked() returns false
// and the Layer 1 frontend validator does NOT block submit.

const VALID_C1_DRAFT = {
  '問題範圍': '聚焦 Spotify 免費版 Android / iOS App 的廣告插播體驗，排除付費訂閱方案與桌面版，時間邊界設為用戶聆聽連續 20 分鐘後首次出現的廣告插播點。',
  '時間範圍': '3 個月觀察期，以季度廣告活動週期對齊；前 6 週 A/B 實驗，後 6 週穩定追蹤留存。',
  '業務影響': '廣告展示完整率不低於現況 72%，免費轉付費月轉換率不下跌超過 0.5 百分點，廣告主 CPM 成本不上升超過 8%。',
  '假設確認': '用戶廣告負感主要源自時機不當（正在進入心流時被打斷），而非廣告本身頻率；移動對話框時機可降低 30% 跳出率。',
};

// ── Boot to CIRCLES home (clears stale state, prevents session auto-resume) ────

async function bootToCirclesHome(page) {
  // §3.10 / Pitfall 14: clear pmDrillState + pmdrill:* cache so no stale session restore.
  // Preserve Supabase auth token (sb-*-auth-token) — storageState writes it to localStorage
  // and the SDK reads it on boot. Clearing ALL localStorage → waitForAuth times out.
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('pmDrillState');
      const draftKeys = Object.keys(localStorage).filter(k => k.startsWith('pmdrill:'));
      draftKeys.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch (_) {}
  });

  // §3.10 carve-out: stub ALL session-list GETs (circles + nsm + guest variants) so the app
  // cannot auto-resume an existing session and navigate away from CIRCLES home.
  // Gate POST is NOT stubbed — it goes to real backend + real OpenAI (Pitfall 11).
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

  // Wait for CIRCLES home mode selector (confirms app loaded and is not in NSM/auth view)
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 20_000 });

  // Remove session-list stubs — subsequent CRUD calls (draft POST, gate POST) go to real backend
  await page.unrouteAll({ behavior: 'ignoreErrors' });
}

// ── Navigate into Phase 1 drill C1 (pick any question) ────────────────────────

async function navigateToDrillPhase1(page) {
  // Click drill mode button (data-circles-mode="drill" per app.js line 5727)
  await page.locator('[data-circles-mode="drill"]').click();

  // Wait for question cards (data-circles="qcard" per app.js line 5624)
  await page.locator('[data-circles="qcard"]').first().waitFor({ state: 'visible', timeout: 10_000 });

  // Click first qcard to expand confirm overlay
  await page.locator('[data-circles="qcard"]').first().click();

  // Confirm to enter Phase 1 (data-circles="qcard-confirm" per app.js line 5620)
  await page.locator('[data-circles="qcard-confirm"]').first().waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('[data-circles="qcard-confirm"]').first().click();

  // Phase 1 form should appear
  await page.locator('[data-circles-phase="1"]').waitFor({ state: 'visible', timeout: 10_000 });

  // Confirm Phase 1 is active
  const phase = await page.evaluate(() => window.AppState && window.AppState.circlesPhase);
  if (phase !== 1) {
    throw new Error(`Expected circlesPhase=1 after question confirm, got: ${phase}`);
  }
}

// ── Main spec ─────────────────────────────────────────────────────────────────

test.describe('F-CT1.3 gate full-chain: Phase 1 → real gate → result renders → reload persists (3 vp)', () => {
  // §3.7: storageState applied via playwright.config.js project-level use.storageState
  // e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari each inject AUTH_FILE

  test('Phase 1 submit → real gate (backoff patch present) → result renders → reload session persists', async ({ page }) => {

    // Pitfall 14: test-local state — not module-level
    let capturedSessionId = null;
    let gateRequestCount = 0;
    const gateTimestamps = { start: 0, end: 0 };

    await test.step('boot to CIRCLES home', async () => {
      await bootToCirclesHome(page);
    });

    await test.step('navigate to Phase 1 drill C1 form', async () => {
      await navigateToDrillPhase1(page);
    });

    await test.step('monitor gate request timing (observe, not mock)', async () => {
      // §3.10: observe-only route (no stubbing on gate POST — Pitfall 11).
      // We passthrough the gate POST to real backend but record timing for regression info.
      // This confirms the gate POST is fired exactly once from the browser
      // (the server-side backoff retry is transparent to the browser).
      await page.route('**/api/circles-sessions/**/gate', async (route) => {
        if (route.request().method() === 'POST') {
          gateRequestCount++;
          gateTimestamps.start = Date.now();
          await route.continue();
          // Note: route.continue() resolves immediately after forwarding — response
          // timing is captured separately via waitForResponse.
        } else {
          await route.continue();
        }
      });
    });

    await test.step('inject framework draft into AppState + submit', async () => {
      // §3.4 / Pitfall 18: inject valid C1 draft directly into AppState then call render()
      // so the Layer 1 minLength gate enables the submit button.
      // Keys must match CIRCLES_STEP_CONFIG.C1.fields[*].key Chinese keys.
      await page.evaluate((draft) => {
        if (!window.AppState.circlesFrameworkDraft) window.AppState.circlesFrameworkDraft = {};
        window.AppState.circlesFrameworkDraft['C1'] = draft;
        window.AppState.circlesMode  = 'drill';
        window.AppState.circlesDrillStep = 'C1';
        // Re-render so Layer 1 minLength gate recalculates and enables submit button
        if (window.render) window.render();
      }, VALID_C1_DRAFT);

      // §3.6 / Pitfall 3: wait for button enabled state before clicking
      const submitBtn = page.locator('[data-phase1="submit"]').first();
      await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
      await submitBtn.click();
    });

    await test.step('wait for Phase 1.5 loading state (gate in-flight)', async () => {
      // Gate transitions browser to Phase 1.5 loading immediately after submit
      await page.locator('[data-circles-phase="1.5"]').waitFor({ state: 'visible', timeout: 15_000 });

      // §3.14 expect.poll: circlesSession.id is populated asynchronously after draft create.
      // Poll until it appears (may take a frame or two after Phase 1.5 renders).
      await expect.poll(async () => {
        capturedSessionId = await page.evaluate(() =>
          (window.AppState && window.AppState.circlesSession && window.AppState.circlesSession.id) || null
        );
        return capturedSessionId !== null;
      }, { timeout: 10_000, intervals: [200, 500] }).toBe(true);

      console.log(`[fct1.3] Phase 1.5 loading. sessionId=${capturedSessionId}`);
    });

    await test.step('assert gate POST fired exactly once (server-side backoff is transparent)', async () => {
      // §3.10 / Pitfall 14: by the time Phase 1.5 is visible, the gate POST has been sent.
      // The server internally retries OpenAI with 800ms backoff (F-CT1.3 fix) but the
      // browser only sees ONE gate POST. This assert confirms the architecture is correct
      // and the browser-level retry is not firing (which would be a separate app bug).

      // Wait for gate POST to have been recorded (may arrive in same tick as Phase 1.5)
      await expect.poll(
        () => gateRequestCount,
        { timeout: 5_000, intervals: [200] }
      ).toBeGreaterThanOrEqual(1);

      expect(gateRequestCount).toBe(1);
      console.log(`[fct1.3] Gate POST count: ${gateRequestCount} (expected: 1 — server-side backoff is transparent to browser)`);

      // Remove gate observer route now that it's served its purpose
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });

    await test.step('wait for gate result from real OpenAI (allow up to 60s)', async () => {
      // §3.14: expect.poll — no hard sleep (Prohibition 3).
      // Allow up to 60s for real OpenAI response + server-side backoff overhead.
      await expect.poll(async () => {
        const loading = await page.locator('.gate-loading-wrap').count();
        const result  = await page.locator('.gate-transition').count();
        return loading === 0 && result > 0;
      }, { timeout: 60_000, intervals: [1000, 2000, 3000] }).toBe(true);

      gateTimestamps.end = Date.now();
      const totalMs = gateTimestamps.end - gateTimestamps.start;
      console.log(`[fct1.3] Gate total round-trip: ${totalMs}ms`);
    });

    await test.step('assert gate result UI rendered correctly (not stuck, not infra-error)', async () => {
      // Phase 1.5 container must be visible with gate result
      await expect(page.locator('[data-circles-phase="1.5"]')).toBeVisible();

      // gate-transition element confirms result rendered (not stuck spinner / infra timeout)
      const gateTransition = page.locator('.gate-transition').first();
      await expect(gateTransition).toBeVisible();

      // overallStatus must be one of the 3 valid outcomes (ok / warn / error)
      const isOk    = await page.locator('.gate-transition--ok').count() > 0;
      const isWarn  = await page.locator('.gate-transition--warn').count() > 0;
      const isError = await page.locator('.gate-transition--error').count() > 0;
      expect(isOk || isWarn || isError).toBe(true);

      // gateInflight must be cleared (gate not stuck in mutex)
      const gateInflight = await page.evaluate(() => window.AppState && window.AppState.gateInflight);
      expect(gateInflight).toBeFalsy();

      // circlesGateError must be null (no GATE_API_ERROR / GATE_PARSE_ERROR)
      const gateError = await page.evaluate(() => window.AppState && window.AppState.circlesGateError);
      expect(gateError).toBeFalsy();

      const status = isOk ? 'ok' : isWarn ? 'warn' : 'error';
      console.log(`[fct1.3] Gate result: ${status}. gateInflight cleared, no infra error.`);
    });

    await test.step('page.reload() → gate result in DB, session recoverable (RITUAL §1)', async () => {
      // RITUAL §1 full chain: the gate result was PATCH'd to DB (app.js line 7930+:
      // "await gateResult PATCH BEFORE rendering gate-pass UI"). After reload:
      //   - Phase resets to 1 (by design: circlesPhase 1.5 → 1 on restore, app.js line 179)
      //   - The session row in DB should have gate_result + lifecycle = 'gated'/'gate_fail'
      //
      // We verify DB persistence by making a direct API GET for the session after reload.
      // If the session exists in DB and has gate_result set, the RITUAL §1 chain is proven.

      await page.reload();

      // Wait for auth to restore after reload
      await page.waitForFunction(
        () => window.AppState && !!window.AppState.accessToken,
        { timeout: 15_000 }
      );

      if (capturedSessionId) {
        // Direct DB verification: GET /api/circles-sessions/:id and check gate_result exists
        const dbCheck = await page.evaluate(async (sid) => {
          try {
            const res = await window.apiFetch(`/api/circles-sessions/${sid}`, { method: 'GET' });
            if (!res.ok) return { ok: false, status: res.status };
            const data = await res.json();
            return {
              ok: true,
              hasGateResult: !!(data.gate_result),
              lifecycle: data.lifecycle,
            };
          } catch (e) {
            return { ok: false, error: e.message };
          }
        }, capturedSessionId);

        console.log(`[fct1.3] Reload DB check: ${JSON.stringify(dbCheck)}`);

        expect(dbCheck.ok).toBe(true);
        // gate_result must be persisted in DB (not null) — this is the RITUAL §1 key assertion
        expect(dbCheck.hasGateResult).toBe(true);
        // lifecycle is 'gated' when gate_ok (canProceed=true), otherwise stays 'created'/'editing'
        // (per session-lifecycle.js: gate_fail does NOT promote lifecycle).
        // Valid values: 'created' | 'editing' | 'gated' — all are valid depending on AI outcome.
        expect(['created', 'editing', 'gated']).toContain(dbCheck.lifecycle);

        console.log(`[fct1.3] Reload: DB gate_result persisted. lifecycle=${dbCheck.lifecycle}`);
      } else {
        // Fallback: no sessionId captured (edge case) — just verify app loaded correctly
        // and Phase 1 is visible (proves state restored from localStorage at minimum)
        console.warn('[fct1.3] Reload: no sessionId captured — fallback: check app loaded');
        await page.waitForFunction(
          () => window.AppState && window.AppState.circlesPhase !== undefined,
          { timeout: 10_000 }
        );
        // App should be in CIRCLES view after reload (not auth)
        const view = await page.evaluate(() => window.AppState && window.AppState.view);
        expect(view).toBe('circles');
        console.log('[fct1.3] Reload: app in circles view (sessionId unavailable for DB check)');
      }
    });

    await test.step('cleanup: delete test session from DB', async () => {
      if (!capturedSessionId) {
        console.log('[fct1.3] cleanup: no sessionId captured — nothing to delete');
        return;
      }
      // Use apiFetch to DELETE test session (mirrors auto-cleanup fixture pattern)
      const deleteResult = await page.evaluate(async (sid) => {
        try {
          const res = await window.apiFetch(`/api/circles-sessions/${sid}`, { method: 'DELETE' });
          return { status: res.status, ok: res.ok };
        } catch (e) {
          return { error: e.message };
        }
      }, capturedSessionId);

      if (deleteResult.error) {
        console.warn(`[fct1.3] cleanup: DELETE threw: ${deleteResult.error}`);
      } else if (deleteResult.status === 404) {
        console.warn('[fct1.3] cleanup: session already gone (404)');
      } else if (!deleteResult.ok) {
        console.warn(`[fct1.3] cleanup: DELETE returned ${deleteResult.status}`);
      } else {
        console.log(`[fct1.3] cleanup: session ${capturedSessionId} deleted OK`);
      }
    });
  });
});
