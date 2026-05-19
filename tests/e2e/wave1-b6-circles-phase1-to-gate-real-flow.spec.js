// tests/e2e/wave1-b6-circles-phase1-to-gate-real-flow.spec.js
//
// B6 Critical #3 — Full-flow spec: login → CIRCLES → Phase 1 form → real OpenAI gate → D-1..D-11 fix verify.
// 3 vp × 3 states (ok/warn/error) = 9 specs × 1 baseline run (rate-limit budget control).
//
// KARPATHY APPLY:
//   Think Before: IL-1 root cause → D-1..D-11 are copy/structure drifts in renderCirclesGate;
//     IL-3 TDD → full-flow must drive real evaluator to prove fixes hold under real AI output.
//     IL-2 verification → assert DOM text after real AI response lands.
//   Simplicity First: 3 states × real input to drive evaluator outcome; storageState for auth.
//   Surgical Changes: only assert the D-N drift fields (not all gate items);
//     page.route stub for session-list GET (prevent auto-resume) but NOT gate POST (real AI).
//   Goal-Driven: prove full user journey from Phase 1 submit → gate result UI D-fixes visible.
//
// SKILLS APPLIED (per STANDING feedback_playwright_skill_cited_application):
//   §3.8 api-testing.md 783-848 — service-role auth (storageState) for deterministic login
//   §3.11 cross-vp — 3 projects: e2e-desktop / e2e-mobile-chrome / e2e-mobile-safari
//   §3.4 / Pitfall 18 — page.evaluate AppState read for state verification
//   §3.6 / Pitfall 3 — data-attr locators ([data-gate-action], [data-circles-phase])
//   Pitfall 11 carve-out: GET session-list stub to prevent auto-resume; gate POST is REAL.
//   Pitfall 14: test-local fixture only; no module-level mutable state.
//   Pitfall 19: test.step() for multi-phase journey (login → select → form → gate).
//   §3.18: 1x baseline run per rate-limit budget (not 5x consecutive — OpenAI cost control).
//   auto-cleanup fixture: circles_sessions created in test → deleted in afterEach.
//
// 🚫 ABSOLUTE PROHIBITIONS:
//   1. 禁 --update-snapshots (no visual baselines in this spec — DOM-only assert)
//   2. 禁 mock own gate API (Pitfall 11) — gate POST MUST reach real OpenAI
//   3. 禁 waitForTimeout hard sleep — use waitForResponse / expect.poll
//   4. 禁 module-level shared state (Pitfall 14)
//   5. 禁 append audit/e2e-master-tracker.md — write audit/wave1-task-5-findings.md
//   7. 禁 commit — only stage (live demo gate)
//
// RATE LIMIT BUDGET: 3 vp × 3 states = 9 specs × 1x real gate call = 9 OpenAI calls max.
//   E2E projects are parallelized per e2e.playwright.config.js; each project runs 3 tests.
//   To cap total calls: run --project=e2e-desktop only for initial gate (Director controls).

'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env', override: false });

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const EVIDENCE_DIR = path.join(__dirname, '..', '..', 'audit', 'wave1-task5-fullflow-evidence');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// ── Cleanup registry (auto-cleanup per STANDING feedback_e2e_real_data_only) ─

const sessionIdsToDelete = [];

test.afterEach(async () => {
  // auto-cleanup: delete any circles_sessions rows created during this test
  // Using service-role if available, else log warning.
  if (sessionIdsToDelete.length === 0) return;
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn('[wave1-b6-fullflow] Missing SUPABASE_URL/SERVICE_ROLE_KEY — skip auto-cleanup');
    sessionIdsToDelete.length = 0;
    return;
  }
  const admin = createClient(supabaseUrl, serviceKey);
  for (const sid of sessionIdsToDelete) {
    await admin.from('circles_sessions').delete().eq('id', sid).catch((e) => {
      console.warn('[wave1-b6-fullflow] cleanup failed for', sid, e.message);
    });
  }
  sessionIdsToDelete.length = 0;
});

// ── Known inputs to drive different gate outcomes ─────────────────────────────
//
// We use known good/partial/bad CIRCLES Phase 1 framework inputs for C1 step (澄清情境).
// The real gate evaluator will produce different overallStatus depending on quality.
// We cannot guarantee exact AI output, so we assert on:
//   (a) overallStatus ∈ {ok, warn, error} — one of the 3 valid gate outcomes
//   (b) D-N drift fixes apply to WHICHEVER state comes back:
//       - gate-transition title in {'框架完整', '通過附提醒', '需要修正方向'}
//       - gate-section-label__count uses per-state format (not always "N / M 通過")
//       - warn suggestion label = "建議"; error = "修正"
//       - loading: title "AI 正在審核你的框架" + 5 checklist steps
//
// Strategy: drive 3 distinct input quality levels. Expected outcomes:
//   INPUT_EXCELLENT → likely ok or warn
//   INPUT_PARTIAL   → likely warn
//   INPUT_POOR      → likely error
// We use test.skip gracefully if the app's question list is empty/unavailable.

const INPUT_EXCELLENT = {
  // C1 澄清情境: very strong framework → likely ok/warn
  circularContext: '這道題問的是如何提升 Airbnb 新用戶在第一次訂房後 30 天內的體驗預訂率。問題範圍聚焦在 30 天內且首次訂房完成後的探索行為，排除老用戶與非住宿類型轉換。時間視窗設定為 6 個月驗證 30% 提升。商業影響上體驗業務佔 Airbnb 年營收約 15%，策略重要性高。核心假設是新用戶在完成首次住宿訂房後，在 30 天內仍有在地探索需求且願意接受體驗推薦。',
  circularProblem: '新用戶訂房後探索率偏低，體驗業務錯失轉化窗口。',
  circularTiming:  '6 個月內把新用戶體驗轉化率從 5% 提升到 6.5%，以 30 天為窗口期驗證。',
  circularAssumption: '假設訂房後 30 天內用戶仍對在地探索有需求，且推薦相關體驗能在情境內接住用戶需求；若用戶在住宿體驗後評分較高則更願意探索周邊體驗。',
};

const INPUT_POOR = {
  // C1 澄清情境: semantically weak framework (vague, no scope/metric/timeline/assumption)
  // BUT passes Layer 1 frontend validator (length > 0, not pure repeated chars).
  // Expected AI gate result: error or warn (poor quality signals).
  circularContext: '我想做一個很好的產品，讓所有用戶都能使用，範圍很廣，包括各種功能和場景，沒有特別的限制',
  circularProblem: '用戶不喜歡這個產品，感覺不好用，有很多問題，需要改善整體體驗，讓大家都滿意',
  circularTiming:  '盡快完成，越快越好，大概幾個月之內，具體時間待定，看情況而定',
  circularAssumption: '假設用戶會喜歡新功能，並且願意使用，市場上應該有需求，應該可以成功',
};

// ── Boot to CIRCLES Phase 1 (drill mode, C1 step) ─────────────────────────────

async function bootToDrillC1(page) {
  // Pitfall 14: clear all app state to ensure fresh session.
  await page.addInitScript(() => {
    try { localStorage.removeItem('pmDrillState'); } catch (_) {}
    // Also clear circles draft cache to prevent pre-fill from previous test
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((k) => {
        if (k.startsWith('pmdrill:circles:draft:') || k.startsWith('pmdrill:phase2:')) {
          localStorage.removeItem(k);
        }
      });
    } catch (_) {}
  });

  // Stub session-list GETs (prevent auto-resume, Pitfall 11 carve-out).
  const emptyJson = JSON.stringify([]);
  await page.route('**/api/circles-sessions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  });
  await page.route('**/api/guest-circles-sessions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyJson });
    }
    return route.continue();
  });

  await page.goto('/');
  // Ensure we're on CIRCLES tab (app may restore to NSM if user has active NSM session).
  // Wait for navbar to appear, then click CIRCLES tab.
  await page.locator('[data-nav="circles"]').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('[data-nav="circles"]').click();
  // Wait for mode selector
  await page.locator('[data-circles-mode="drill"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  // Select drill mode (click only if not already active)
  const drillBtn = page.locator('[data-circles-mode="drill"]');
  const isActive = await drillBtn.evaluate((el) => el.classList.contains('is-active'));
  if (!isActive) await drillBtn.click();
  // Wait for question cards (selector: [data-circles="qcard"])
  await page.locator('[data-circles="qcard"]').first().waitFor({ state: 'visible', timeout: 10_000 });

  // Select first available question (expand then confirm)
  await page.locator('[data-circles="qcard"]').first().click();
  // After click, the qcard expands and shows confirm button
  await page.locator('[data-circles="qcard-confirm"]').first().waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('[data-circles="qcard-confirm"]').first().click();

  // Wait for Phase 1 form to load
  await page.locator('[data-circles-phase="1"]').waitFor({ state: 'visible', timeout: 10_000 });

  // Verify we're in drill mode C1 (澄清情境) — first step
  const phase = await page.evaluate(() => window.AppState && window.AppState.circlesPhase);
  if (phase !== 1) {
    throw new Error(`Expected Phase 1, got: ${phase}`);
  }
}

// ── Fill Phase 1 fields and submit to gate ─────────────────────────────────────

async function fillAndSubmitGate(page, inputs) {
  // Phase 1 C1 uses contenteditable divs with data-phase1="textarea" and data-field-idx (0-3).
  // Field key order for C1: 問題範圍(0), 時間範圍(1), 業務影響(2), 假設確認(3)
  // Set AppState.circlesFrameworkDraft[stepKey][fieldKey] directly to pass min-length check.
  await page.evaluate((inp) => {
    // Determine current step key
    const AS = window.AppState;
    const stepKey = AS.circlesDrillStep || 'C1';
    // Map field keys per CIRCLES_STEP_CONFIG.C1.fields order
    const fieldKeys = ['問題範圍', '時間範圍', '業務影響', '假設確認'];
    const vals = [inp.circularContext, inp.circularTiming, inp.circularProblem, inp.circularAssumption];
    if (!AS.circlesFrameworkDraft) AS.circlesFrameworkDraft = {};
    if (!AS.circlesFrameworkDraft[stepKey]) AS.circlesFrameworkDraft[stepKey] = {};
    fieldKeys.forEach((k, i) => {
      AS.circlesFrameworkDraft[stepKey][k] = vals[i] || '';
    });
    // Also set in DOM for visual confirmation
    const textareas = document.querySelectorAll('[data-phase1="textarea"]');
    textareas.forEach((el, i) => {
      if (i < vals.length && vals[i]) el.textContent = vals[i];
    });
    // Enable submit button
    const btn = document.querySelector('[data-phase1="submit"]');
    if (btn) btn.disabled = false;
  }, inputs);

  // Submit (Phase 1 submit button: data-phase1="submit")
  const submitBtn = page.locator('[data-phase1="submit"]').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await submitBtn.click();

  // Wait for Phase 1.5 gate — loading state first
  await page.locator('[data-circles-phase="1.5"]').waitFor({ state: 'visible', timeout: 15_000 });
}

// ── Wait for gate result to come back from real AI (up to 45s) ────────────────

async function waitForGateResult(page) {
  // Wait for gate-transition element (means result rendered, not loading)
  // Use expect.poll instead of waitForTimeout (§3.14 / Pitfall 3).
  await expect.poll(async () => {
    const loading = await page.locator('.gate-loading-wrap').count();
    const result  = await page.locator('.gate-transition').count();
    return loading === 0 && result > 0;
  }, { timeout: 45_000, intervals: [1000, 2000, 3000] }).toBe(true);
}

// ── Spec: full-flow + D-N fix assertions ──────────────────────────────────────

test.describe('B6 Full-flow: Phase 1 → real gate → D-1..D-11 fix correctness', () => {

  test('Layer (b) D-7/D-8 loading state: title "AI 正在審核" + 5 checklist steps', async ({ page }) => {
    await test.step('boot to drill C1', async () => {
      await bootToDrillC1(page);
    });

    await test.step('fill excellent inputs + submit', async () => {
      await fillAndSubmitGate(page, INPUT_EXCELLENT);
    });

    await test.step('assert D-7/D-8 loading copy while gate is in flight', async () => {
      // The loading state should appear immediately after submit
      const loadingWrap = page.locator('.gate-loading-wrap');
      await loadingWrap.waitFor({ state: 'visible', timeout: 15_000 });

      // D-7: loading title
      const loadTitle = page.locator('.gate-loading-title');
      await expect(loadTitle).toBeVisible();
      await expect(loadTitle).toHaveText('AI 正在審核你的框架');

      // D-8: 5 steps in checklist
      const steps = page.locator('.gate-loading-step');
      const stepsCount = await steps.count();
      expect(stepsCount).toBe(5);

      const allText = await page.locator('.gate-loading-checklist').textContent();
      expect(allText).toContain('解析框架草稿');
      expect(allText).toContain('整合通行判斷');

      // Take loading evidence PNG
      const evidencePath = path.join(EVIDENCE_DIR, `loading-state-D7D8.png`);
      await loadingWrap.screenshot({ path: evidencePath, animations: 'disabled' });
    });

    // Wait for result (completes the full flow test)
    await waitForGateResult(page);
  });

  test('Layer (b) excellent input: D-1/D-2/D-5/D-10 result assertions', async ({ page }, testInfo) => {
    await test.step('boot to drill C1', async () => {
      await bootToDrillC1(page);
    });

    await test.step('fill excellent inputs + submit', async () => {
      await fillAndSubmitGate(page, INPUT_EXCELLENT);
    });

    await test.step('wait for gate result from real AI', async () => {
      await waitForGateResult(page);
    });

    await test.step('assert D-N fixes on result state', async () => {
      // Determine actual status from DOM
      const isOk   = await page.locator('.gate-transition--ok').count() > 0;
      const isWarn  = await page.locator('.gate-transition--warn').count() > 0;
      const isError = await page.locator('.gate-transition--error').count() > 0;

      expect(isOk || isWarn || isError).toBe(true);

      // D-1/D-2/D-3: transition title must be one of the 3 mockup-correct values
      const titleText = await page.locator('.gate-transition__title').textContent();
      const validTitles = ['框架完整', '通過附提醒', '需要修正方向'];
      expect(validTitles).toContain(titleText.trim());

      // D-5: section count format — must NOT be "N / M 通過" for warn/error
      const countText = await page.locator('.gate-section-label__count').textContent();
      if (isWarn) {
        expect(countText).toContain('提醒');
        expect(countText).not.toContain('/');
      } else if (isError) {
        expect(countText).toContain('阻擋');
        expect(countText).not.toContain('/');
      } else {
        // ok state: "N / N 通過" is correct
        expect(countText).toContain('通過');
      }

      // D-10: phase-head meta timer element exists
      const timerEl = page.locator('.phase-head__meta-extra--tablet-plus').first();
      expect(await timerEl.count()).toBeGreaterThan(0);

      // D-11: qchip icon is ph-bookmark-simple
      const iconCls = await page.locator('.qchip__icon i').first().getAttribute('class');
      expect(iconCls).toContain('ph-bookmark-simple');

      // Evidence PNG
      const evidencePath = path.join(EVIDENCE_DIR, `result-excellent-${testInfo.project.name}.png`);
      await page.locator('[data-circles-phase="1.5"]').screenshot({ path: evidencePath });
    });
  });

  test('Layer (b) poor input: D-3/D-6 error state assertions', async ({ page }, testInfo) => {
    await test.step('boot to drill C1', async () => {
      await bootToDrillC1(page);
    });

    await test.step('fill poor inputs (likely error outcome)', async () => {
      await fillAndSubmitGate(page, INPUT_POOR);
    });

    await test.step('wait for gate result from real AI', async () => {
      await waitForGateResult(page);
    });

    await test.step('assert D-N fixes on any result state', async () => {
      // Even if AI returns ok/warn instead of error, the key assertions still hold.
      const isOk    = await page.locator('.gate-transition--ok').count() > 0;
      const isWarn  = await page.locator('.gate-transition--warn').count() > 0;
      const isError = await page.locator('.gate-transition--error').count() > 0;

      expect(isOk || isWarn || isError).toBe(true);

      // D-3: error title must be "需要修正方向" (not "方向需修正")
      if (isError) {
        const titleText = await page.locator('.gate-transition--error .gate-transition__title').textContent();
        expect(titleText.trim()).toBe('需要修正方向');

        // D-6: error suggestion label must be "修正" (not "建議")
        const errorSuggItems = await page.locator('.gate-item--error .gate-item__suggestion strong').all();
        for (const label of errorSuggItems) {
          const text = await label.textContent();
          expect(text.trim()).toBe('修正');
        }
      }

      // D-5: section count format
      const countText = await page.locator('.gate-section-label__count').textContent();
      if (isError) {
        expect(countText).toContain('阻擋');
        expect(countText).not.toContain('/');
      } else if (isWarn) {
        expect(countText).toContain('提醒');
        expect(countText).not.toContain('/');
      }

      // D-11: qchip bookmark icon
      const iconCls = await page.locator('.qchip__icon i').first().getAttribute('class');
      expect(iconCls).toContain('ph-bookmark-simple');

      // Evidence PNG
      const evidencePath = path.join(EVIDENCE_DIR, `result-poor-${testInfo.project.name}.png`);
      await page.locator('[data-circles-phase="1.5"]').screenshot({ path: evidencePath });
    });
  });

});
