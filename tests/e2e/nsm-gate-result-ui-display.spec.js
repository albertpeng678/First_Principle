// tests/e2e/nsm-gate-result-ui-display.spec.js
//
// P0-NEW-7 — NSM gate ok/warn MUST display gate result UI before advancing
//
// Bug: app.js:1973-1978 auto-advances nsmSubTab='nsm-step3' for ok/warn cases,
// bypassing the gate result UI (mockup 08 三態 contract).
//
// Fix (Option A, user-approved): keep nsmSubTab='nsm-gate' so renderNSMGate()
// renders the result UI + proceed button; user clicks proceed → advance to step 3.
//
// Skill citations:
//   common-pitfalls.md Pitfall 19 — test.step() per phase
//   common-pitfalls.md Pitfall 11 — NO own-API mock; real Supabase + real OpenAI
//   assertions-and-waiting.md "Web-First Assertions" — toBeVisible auto-retry
//   locator-strategy.md priority order — data-attribute locators first

'use strict';

const { test, expect } = require('@playwright/test');

// ── Substantive NSM data (same constants as nsm-full-flow.spec.js) ─────────────
// These pass hasSubstantiveContent gate reliably per lifecycle-nsm.spec.js line 32-39.
const SUBSTANTIVE_NSM = '週活躍 Podcast 用戶數（Weekly Active Podcast Users），定義為過去 7 天內在 Spotify 上播放超過 5 分鐘 Podcast 內容的去重用戶數';
const SUBSTANTIVE_EXPLANATION = '直接反映核心使用行為，且與廣告收入正相關，週頻率符合 Podcast 聆聽習慣，同時避免 day-of-week 偏差';
const SUBSTANTIVE_BUSINESS_LINK = 'Podcast 廣告 CPM 是音樂的 3-5 倍，提升此指標直接增加變現效率';

const QUESTION_ID = 'nsm_001';
const QUESTION_JSON = {
  id: 'nsm_001',
  problem_statement: '設計一個功能，讓 Spotify 的 Podcast 用戶更容易發現和訂閱符合自己喜好的節目',
  product_context: 'Spotify 是全球最大的音樂串流平台，月活躍用戶超過 5 億，Podcast 是近年重要增長引擎',
};

// ── Boot + auth helpers (mirrors nsm-full-flow.spec.js) ───────────────────────
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

async function waitForAuth(page) {
  await page.waitForFunction(
    () => window.AppState && !!window.AppState.accessToken,
    { timeout: 15_000 }
  );
}

async function deleteNsmSessionFromPage(page, sid) {
  if (!sid) return;
  await page.evaluate(async (sessionId) => {
    try {
      await window.apiFetch('/api/nsm-sessions/' + sessionId, { method: 'DELETE' });
    } catch (_) {}
  }, sid);
}

// ── THE SPEC ──────────────────────────────────────────────────────────────────
test.describe('P0-NEW-7 — NSM gate result UI display for ok/warn cases', () => {
  // Real OpenAI server-side calls → must use test.slow() (3× timeout).
  test.slow();

  // storageState from auth.setup.js (e2e-desktop project).
  test.use({ storageState: 'playwright/.auth/user.json' });

  let sessionId = null;

  test.afterEach(async ({ page }) => {
    // Safety-net cleanup regardless of test pass/fail.
    await deleteNsmSessionFromPage(page, sessionId);
    sessionId = null;
  });

  test(
    'AC-1: NSM gate ok/warn result MUST display gate UI before advancing (mockup 08 三態)',
    async ({ page }) => {
      // ────────────────────────────────────────────────────────────────────────
      // Phase 1 — seed NSM session + advance to Step 2 with substantive content
      // ────────────────────────────────────────────────────────────────────────
      await test.step('seed NSM session + boot to Step 2 with substantive content', async () => {
        await bootApp(page);
        await waitForAuth(page);

        // Seed NSM session via apiFetch (api-testing.md 783-848).
        sessionId = await page.evaluate(async ({ qid, qjson }) => {
          const res = await window.apiFetch('/api/nsm-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId: qid, questionJson: qjson }),
          });
          if (!res.ok) throw new Error('seed NSM session failed: ' + res.status);
          const data = await res.json();
          const sid = data.sessionId || data.id;
          window.AppState.nsmSession = { id: sid };
          window.AppState.nsmSelectedQuestion = qjson;
          return sid;
        }, { qid: QUESTION_ID, qjson: QUESTION_JSON });

        expect(sessionId).toBeTruthy();

        // Advance to Step 2 with substantive definition.
        await page.evaluate(({ nsm, explanation, businessLink }) => {
          window.AppState.view = 'nsm';
          window.AppState.nsmStep = 2;
          window.AppState.nsmSubTab = 'nsm-step2';
          window.AppState.nsmDefinition = { nsm, explanation, businessLink };
          window.AppState.nsmGateResult = null;
          window.AppState.nsmGateLoading = false;
          window.AppState.nsmGateError = null;
          window.render();
        }, { nsm: SUBSTANTIVE_NSM, explanation: SUBSTANTIVE_EXPLANATION, businessLink: SUBSTANTIVE_BUSINESS_LINK });

        // Step 2 must be visible with submit button enabled.
        await expect(page.locator('[data-nsm-submit]')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('[data-nsm-submit]')).not.toHaveAttribute('disabled');
      });

      // ────────────────────────────────────────────────────────────────────────
      // Phase 2 — click submit → wait for gate → assert gate result UI visible
      //           BUG: currently auto-advances to step3, skipping gate result UI
      //           FIX: gate result UI [data-nsm-gate-action="proceed"] must appear
      // ────────────────────────────────────────────────────────────────────────
      await test.step('submit gate → assert gate result UI visible (NOT auto-advanced)', async () => {
        // Click submit — triggers real OpenAI gate POST server-side (cannot mock).
        await page.locator('[data-nsm-submit]').click();

        // Wait for gate POST to complete (nsmGateResult set).
        // 90s covers real OpenAI latency.
        await page.waitForFunction(
          () => window.AppState &&
                window.AppState.nsmGateResult !== null &&
                window.AppState.nsmGateResult !== undefined,
          { timeout: 90_000 }
        );

        const gateResult = await page.evaluate(() => window.AppState.nsmGateResult);
        expect(gateResult).not.toBeNull();

        const overallStatus = gateResult.overall_status || gateResult.overallStatus;
        expect(['ok', 'warn', 'error']).toContain(overallStatus);

        // CRITICAL AC-1 assertion (mockup 08 三態 contract):
        // For ANY gate result (ok/warn/error), gate result UI MUST be visible.
        // The proceed button is only shown when canProceed=true (ok/warn cases).
        // Back-to-step2 button is shown for all states.
        // [data-nsm-gate-action="back-to-step2"] must ALWAYS be visible.
        await expect(
          page.locator('[data-nsm-gate-action="back-to-step2"]')
        ).toBeVisible({ timeout: 5_000 });

        if (gateResult.canProceed) {
          // ok/warn — proceed button MUST also be visible (P0-NEW-7 fix verification).
          // BEFORE fix: app auto-advanced to step3, so proceed button would NOT be visible.
          // AFTER fix: app keeps nsmSubTab='nsm-gate', so proceed button IS visible here.
          await expect(
            page.locator('[data-nsm-gate-action="proceed"]')
          ).toBeVisible({ timeout: 5_000 });

          // ALSO assert we are NOT already on step 3 (nsmSubTab must be 'nsm-gate').
          const subTab = await page.evaluate(() => window.AppState.nsmSubTab);
          expect(subTab).toBe('nsm-gate');
        } else {
          // error — proceed button must NOT be rendered (canProceed=false, app.js:1502-1506).
          await expect(
            page.locator('[data-nsm-gate-action="proceed"]')
          ).not.toBeVisible({ timeout: 3_000 });
        }
      });

      // ────────────────────────────────────────────────────────────────────────
      // Phase 3 — user clicks proceed → advances to step 3
      //           (only if gate returned ok/warn = canProceed=true)
      // ────────────────────────────────────────────────────────────────────────
      await test.step('user clicks proceed → advances to step 3', async () => {
        const gateResult = await page.evaluate(() => window.AppState.nsmGateResult);
        if (!gateResult || !gateResult.canProceed) {
          // error case — cannot proceed; test passes for this branch.
          // Skip proceed interaction.
          return;
        }

        // Click proceed button (rendered at app.js:1500).
        await page.locator('[data-nsm-gate-action="proceed"]').click();

        // After clicking proceed, handler at app.js:1890-1894 sets nsmStep=3, nsmSubTab='nsm-step3'.
        await page.waitForFunction(
          () => window.AppState && window.AppState.nsmSubTab === 'nsm-step3',
          { timeout: 10_000 }
        );

        // Step 3 UI must be visible (renderNSMStep3 outputs phase-head__title "拆解輸入指標").
        await expect(
          page.locator('.phase-head__title')
        ).toContainText('拆解輸入指標', { timeout: 10_000 });
      });

      // ────────────────────────────────────────────────────────────────────────
      // Phase 4 — cleanup (also covered by afterEach safety net)
      // ────────────────────────────────────────────────────────────────────────
      await test.step('cleanup — DELETE NSM session via apiFetch', async () => {
        await deleteNsmSessionFromPage(page, sessionId);
        sessionId = null;
      });
    }
  );
});
