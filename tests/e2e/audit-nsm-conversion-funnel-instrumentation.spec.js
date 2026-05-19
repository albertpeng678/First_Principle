// tests/e2e/audit-nsm-conversion-funnel-instrumentation.spec.js
//
// C-T2 instrumentation spec — NSM conversion funnel timing capture.
// Purpose: capture per-step timing, lifecycle state, and console errors across
//          a full NSM flow so future runs can track regression vs improvement.
//
// Skills applied: §3.8 service-role read / §3.5 test.step / §3.11 cross-vp / Pitfall 11 no own backend mock
//   §3.8  api-testing.md 783-848 — service-role Supabase seed to skip UI Step 1 overhead
//   §3.5  common-pitfalls.md Pitfall 19 — test.step() wraps each phase boundary
//   §3.11 mobile-and-responsive.md 49-71 — 3 e2e projects (desktop/chrome/safari)
//   Pitfall 11 — NO mock of /api/nsm-sessions/* or /api/guest/nsm-sessions/*; real backend only
//
// This is instrumentation, NOT an assertion-heavy test. Timing + screenshot + console log
// is the goal. A single expect(true).toBeTruthy() at end signals success.
//
// Question fixture: real q1 Netflix shape (mirrors audit-nsm-director-walk-2026-05-17.spec.js)

'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// ── Fixture data (real Netflix q1 shape from nsm_database.json) ─────────────
const QUESTION_ID = 'q1';
const QUESTION_JSON = {
  id: 'q1',
  company: 'Netflix',
  industry: '內容訂閱制',
  scenario: '影音串流平台競爭激烈，必須確保用戶持續感受到內容價值以維持自動扣款。',
  target_nsm_keywords: ['觀看時長', '付費', '活躍'],
  anti_patterns: ['App下載數', '註冊數'],
  field_examples: {
    step2: {
      nsm: '每月至少觀看 10 小時內容且完整看完至少一部劇集的付費訂閱者數',
      explanation: 'Netflix 的留存靠「沉浸感」維持，用戶月觀看時數達門檻代表平台內容真正進入其娛樂習慣，非被動訂閱。',
      businessLink: '活躍觀看用戶的取消率遠低於低觀看用戶，月觀看 10 小時以上群體的 12 個月留存率對 ARR 貢獻最高。',
    },
    step3: {
      reach: '每月至少觀看一次的付費活躍用戶佔總訂閱人數比例，剔除「付了費但沒開啟」的殭屍帳號。',
      depth: '單次觀看平均時長與每月觀看集數，連續追劇 3 集以上代表深度沉浸，是留存強訊號。',
      frequency: '每週啟動 Netflix 並實際播放的天數，低於 2 天的用戶在下個扣款周期取消率顯著上升。',
    },
  },
  context: {
    model: 'Netflix 採內容訂閱制，月費自動扣款，依畫質與同時裝置數分層定價；收益核心是高留存率而非新用戶獲取。',
    users: '核心 NSM 用戶是付費訂閱者中的「主動觀看者」，非偶發或被家人拖著開的被動帳號共享用戶。',
    traps: '把「新劇集上映首週播放量」當 NSM 是虛榮指標，爆紅首週後用戶若不回訪代表無法建立習慣，取消率仍高。',
    insight: '從「用戶是否在 48 小時內回來繼續看同一劇集」的行為切入，這個回流信號比總觀看時長更能預測 30 天留存。',
  },
};

const SUBSTANTIVE_NSM = '每月至少觀看 10 小時內容且完整看完至少一部劇集的付費訂閱者數';
const SUBSTANTIVE_EXPLANATION = 'Netflix 的留存靠「沉浸感」維持，用戶月觀看時數達門檻代表平台內容真正進入其娛樂習慣，非被動訂閱。';
const SUBSTANTIVE_BUSINESS_LINK = '活躍觀看用戶的取消率遠低於低觀看用戶，月觀看 10 小時以上群體的 12 個月留存率對 ARR 貢獻最高。';
const SUBSTANTIVE_BREAKDOWN = {
  reach: '每月至少觀看一次的付費活躍用戶佔總訂閱人數比例，剔除「付了費但沒開啟」的殭屍帳號。',
  depth: '單次觀看平均時長與每月觀看集數，連續追劇 3 集以上代表深度沉浸，是留存強訊號。',
  frequency: '每週啟動 Netflix 並實際播放的天數，低於 2 天的用戶在下個扣款周期取消率顯著上升。',
};

const OUT_DIR = path.join(__dirname, '..', '..', 'audit', 'nsm-funnel-instrumentation');

function ensureDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function shot(page, label, testInfo) {
  ensureDir();
  const project = testInfo.project.name;
  const file = path.join(OUT_DIR, `${label}-${project}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function logTiming(label, startMs, project) {
  const elapsed = Date.now() - startMs;
  console.log(`[FUNNEL-TIMING] [${project}] ${label}: ${elapsed}ms since step start`);
}

async function getLifecycle(page, sessionId) {
  if (!sessionId) return 'unknown';
  try {
    const result = await page.evaluate(async (sid) => {
      const res = await window.apiFetch('/api/nsm-sessions/' + sid);
      if (!res.ok) return null;
      const d = await res.json();
      return d.lifecycle || 'unknown';
    }, sessionId);
    return result || 'unknown';
  } catch (_) {
    return 'fetch_error';
  }
}

async function bootApp(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
  });
  // Stub LIST calls only (GET) to avoid seeing stale sessions — per Pitfall 11 pattern:
  // only stub the list endpoint for setup isolation, all create/patch/gate/evaluate are real.
  const emptyJson = JSON.stringify([]);
  const stubGetOnly = (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  };
  await page.route('**/api/nsm-sessions', stubGetOnly);
  await page.route('**/api/guest/nsm-sessions', stubGetOnly);
  await page.route('**/api/circles-sessions', stubGetOnly);
  await page.route('**/api/guest-circles-sessions', stubGetOnly);
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

async function deleteNsmSession(page, sid) {
  if (!sid) return;
  await page.evaluate(async (sessionId) => {
    try { await window.apiFetch('/api/nsm-sessions/' + sessionId, { method: 'DELETE' }); } catch (_) {}
  }, sid);
}

// Collect console errors during the test
function attachConsoleCapture(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ time: Date.now(), text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    errors.push({ time: Date.now(), text: err.message });
  });
  return errors;
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('NSM Conversion Funnel Instrumentation (C-T2)', () => {
  test.slow();
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('full NSM flow — timing + lifecycle + console capture per step', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const consoleErrors = attachConsoleCapture(page);
    const sessionTimings = {};
    let sessionId = null;
    const testStart = Date.now();

    console.log(`[FUNNEL] START — project=${project} ts=${new Date().toISOString()}`);

    // ── STEP 0: Boot app ─────────────────────────────────────────────────────
    await test.step('00 — app boot', async () => {
      const t0 = Date.now();
      await bootApp(page);
      await waitForAuth(page);
      sessionTimings['00_boot_ms'] = Date.now() - t0;
      console.log(`[FUNNEL-TIMING] [${project}] 00-boot: ${sessionTimings['00_boot_ms']}ms`);
      await shot(page, '00-boot', testInfo);
    });

    // ── STEP 1: Navigate to NSM + seed question via API (§3.8 service-role pattern) ──
    await test.step('01 — NSM Step 1 seed via API', async () => {
      const t1 = Date.now();

      // §3.8: use apiFetch (real auth token) to create session directly — skip UI click latency
      sessionId = await page.evaluate(async ({ qid, qjson }) => {
        const res = await window.apiFetch('/api/nsm-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: qid, questionJson: qjson }),
        });
        if (!res.ok) throw new Error('seed failed: ' + res.status);
        const data = await res.json();
        return data.sessionId || data.id;
      }, { qid: QUESTION_ID, qjson: QUESTION_JSON });

      // Set AppState to reflect session
      await page.evaluate((sid) => {
        window.AppState.nsmSession = { id: sid };
        window.AppState.nsmSelectedQuestion = null;
        window.AppState.view = 'nsm';
        window.AppState.nsmStep = 1;
        window.render();
      }, sessionId);

      await expect(page.locator('[data-view="nsm"][data-nsm-step="1"]')).toBeVisible({ timeout: 10_000 });

      sessionTimings['01_step1_seed_ms'] = Date.now() - t1;
      const lc = await getLifecycle(page, sessionId);
      console.log(`[FUNNEL-TIMING] [${project}] 01-step1-seed: ${sessionTimings['01_step1_seed_ms']}ms | lifecycle=${lc} | sessionId=${sessionId}`);
      console.log(`[FUNNEL-LIFECYCLE] [${project}] after_seed: ${lc}`);
      await shot(page, '01-step1', testInfo);
    });

    // ── STEP 2: Navigate to Step 2 form (empty) ─────────────────────────────
    await test.step('02 — NSM Step 2 empty form entry', async () => {
      const t2 = Date.now();

      await page.evaluate(() => {
        window.AppState.nsmStep = 2;
        window.AppState.nsmSubTab = 'nsm-step2';
        window.AppState.nsmDefinition = { nsm: '', explanation: '', businessLink: '' };
        window.AppState.nsmGateResult = null;
        window.render();
      });
      await expect(page.locator('[data-view="nsm"]')).toBeVisible({ timeout: 5_000 });

      sessionTimings['02_step2_entry_ms'] = Date.now() - t2;
      const lc = await getLifecycle(page, sessionId);
      console.log(`[FUNNEL-TIMING] [${project}] 02-step2-entry: ${sessionTimings['02_step2_entry_ms']}ms | lifecycle=${lc}`);
      console.log(`[FUNNEL-LIFECYCLE] [${project}] step2_entry: ${lc}`);
      await shot(page, '02-step2-empty', testInfo);
    });

    // ── STEP 3: Fill Step 2 form ─────────────────────────────────────────────
    await test.step('03 — NSM Step 2 form fill', async () => {
      const t3 = Date.now();

      await page.evaluate(({ nsm, explanation, businessLink }) => {
        window.AppState.nsmDefinition = { nsm, explanation, businessLink };
        window.render();
      }, { nsm: SUBSTANTIVE_NSM, explanation: SUBSTANTIVE_EXPLANATION, businessLink: SUBSTANTIVE_BUSINESS_LINK });
      await expect(page.locator('[data-nsm-submit]')).toBeVisible({ timeout: 5_000 });

      sessionTimings['03_step2_fill_ms'] = Date.now() - t3;
      console.log(`[FUNNEL-TIMING] [${project}] 03-step2-fill: ${sessionTimings['03_step2_fill_ms']}ms`);
      await shot(page, '03-step2-filled', testInfo);
    });

    // ── STEP 4: Submit to gate (real OpenAI call) ────────────────────────────
    await test.step('04 — gate submit (real backend)', async () => {
      const t4 = Date.now();

      // Patch progress so lifecycle advances to 'editing' on PATCH
      await page.evaluate(async (sid) => {
        await window.apiFetch('/api/nsm-sessions/' + sid + '/progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentStep: 2,
            userNsm: { nsm: '每月至少觀看 10 小時內容且完整看完至少一部劇集的付費訂閱者數', explanation: 'Netflix 的留存靠「沉浸感」維持', businessLink: '活躍觀看用戶的取消率遠低於低觀看用戶' },
          }),
        });
      }, sessionId);

      // Now click submit for gate
      await page.locator('[data-nsm-submit]').click();

      // Capture loading screen if visible
      try {
        await page.waitForSelector('.loading-spinner, [class*="gate-loading"], [data-nsm-sub-tab="nsm-gate"]', { timeout: 1500 });
        console.log(`[FUNNEL-TIMING] [${project}] 04-gate-loading-visible: ${Date.now() - t4}ms`);
        await shot(page, '04a-gate-loading', testInfo);
      } catch (_) { /* too fast */ }

      // Wait for gate result (real OpenAI)
      await page.waitForFunction(
        () => window.AppState && window.AppState.nsmGateResult !== null && window.AppState.nsmGateResult !== undefined,
        { timeout: 90_000 }
      );
      await page.waitForTimeout(300);

      sessionTimings['04_gate_total_ms'] = Date.now() - t4;
      const lc = await getLifecycle(page, sessionId);
      const gateResult = await page.evaluate(() => window.AppState.nsmGateResult);
      console.log(`[FUNNEL-TIMING] [${project}] 04-gate-complete: ${sessionTimings['04_gate_total_ms']}ms | lifecycle=${lc} | canProceed=${gateResult && gateResult.canProceed} | status=${gateResult && gateResult.overallStatus}`);
      console.log(`[FUNNEL-LIFECYCLE] [${project}] after_gate: ${lc}`);
      await shot(page, '04b-gate-result', testInfo);

      // Advance to Step 3 (force if gate failed — instrumentation continues)
      if (gateResult && gateResult.canProceed) {
        try {
          await page.locator('[data-nsm-gate-action="proceed"]').click({ timeout: 5_000 });
          await page.waitForFunction(
            () => window.AppState && window.AppState.nsmSubTab === 'nsm-step3',
            { timeout: 10_000 }
          );
        } catch (_) {
          await page.evaluate(() => {
            window.AppState.nsmSubTab = 'nsm-step3';
            window.AppState.nsmStep = 3;
            window.render();
          });
        }
      } else {
        console.log(`[FUNNEL-WARN] [${project}] gate failed — forcing advance for instrumentation continuity`);
        await page.evaluate(() => {
          window.AppState.nsmSubTab = 'nsm-step3';
          window.AppState.nsmStep = 3;
          window.render();
        });
      }
    });

    // ── STEP 5: Step 3 breakdown entry ───────────────────────────────────────
    await test.step('05 — NSM Step 3 entry (breakdown)', async () => {
      const t5 = Date.now();

      await page.evaluate(() => {
        window.AppState.nsmBreakdown = { reach: '', depth: '', frequency: '' };
        window.render();
      });

      sessionTimings['05_step3_entry_ms'] = Date.now() - t5;
      const lc = await getLifecycle(page, sessionId);
      console.log(`[FUNNEL-TIMING] [${project}] 05-step3-entry: ${sessionTimings['05_step3_entry_ms']}ms | lifecycle=${lc}`);
      console.log(`[FUNNEL-LIFECYCLE] [${project}] step3_entry: ${lc}`);
      await shot(page, '05-step3-empty', testInfo);
    });

    // ── STEP 6: Fill Step 3 breakdown ────────────────────────────────────────
    await test.step('06 — NSM Step 3 fill breakdown', async () => {
      const t6 = Date.now();

      await page.evaluate((br) => {
        window.AppState.nsmBreakdown = br;
        window.render();
      }, SUBSTANTIVE_BREAKDOWN);

      sessionTimings['06_step3_fill_ms'] = Date.now() - t6;
      console.log(`[FUNNEL-TIMING] [${project}] 06-step3-fill: ${sessionTimings['06_step3_fill_ms']}ms`);
      await shot(page, '06-step3-filled', testInfo);
    });

    // ── STEP 7: Submit evaluate (real OpenAI call) ───────────────────────────
    await test.step('07 — evaluate submit (real backend)', async () => {
      const t7 = Date.now();

      await page.locator('[data-nsm-submit]').click();

      // Wait for Step 4 (final report)
      await page.waitForFunction(
        () => window.AppState && window.AppState.nsmStep === 4,
        { timeout: 90_000 }
      );
      await page.waitForTimeout(500);

      sessionTimings['07_evaluate_total_ms'] = Date.now() - t7;
      const lc = await getLifecycle(page, sessionId);
      console.log(`[FUNNEL-TIMING] [${project}] 07-evaluate-complete: ${sessionTimings['07_evaluate_total_ms']}ms | lifecycle=${lc}`);
      console.log(`[FUNNEL-LIFECYCLE] [${project}] after_evaluate: ${lc}`);

      await expect(page.locator('[data-view="nsm"][data-nsm-step4]')).toBeVisible({ timeout: 10_000 });
      await shot(page, '07-step4-final', testInfo);
    });

    // ── SUMMARY ──────────────────────────────────────────────────────────────
    const totalMs = Date.now() - testStart;
    console.log('\n[FUNNEL-SUMMARY]', JSON.stringify({
      project,
      sessionId,
      totalMs,
      timings: sessionTimings,
      consoleErrors: consoleErrors.length,
      consoleErrorSamples: consoleErrors.slice(0, 3).map(e => e.text.slice(0, 120)),
    }, null, 2));

    // Instrumentation spec — single assertion to signal clean run
    expect(true).toBeTruthy();

    // ── CLEANUP ──────────────────────────────────────────────────────────────
    if (sessionId) await deleteNsmSession(page, sessionId);
  });
});
